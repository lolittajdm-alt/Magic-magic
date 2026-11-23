import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";
import { PRICE, PRODUCT_IMAGE_URL, validateOrder } from "../server/order.js";
import { createNovaPoshtaApi } from "../server/nova-poshta.js";
import { orderMessage, shouldNotify } from "./order-message.js";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const fail = (code, message) => Object.assign(new Error(message), { code });
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const states = new Set([
  "created",
  "processing",
  "hold",
  "success",
  "failure",
  "reversed",
  "expired",
]);
const pending = new Set(["created", "processing", "hold"]);
function sign(value, env) {
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex");
}
function ownerOf(req, env, optional = false) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token && optional) return null;
  const [id, expiry, signature] = (token || "").split(".");
  if (
    !/^[a-f\d]{48}$/.test(id || "") ||
    !/^\d{13}$/.test(expiry || "") ||
    !/^[a-f\d]{64}$/.test(signature || "") ||
    Number(expiry) < Date.now() ||
    !timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(sign(`${id}.${expiry}`, env)),
    )
  )
    throw fail(401, "Сесію завершено. Оновіть сторінку магазину.");
  return id;
}
function session(req, env) {
  const id = ownerOf(req, env, true) || randomBytes(24).toString("hex");
  const value = `${id}.${Date.now() + 7 * 86400000}`;
  return `${value}.${sign(value, env)}`;
}
async function body(req) {
  if (!req.headers.get("Content-Type")?.includes("application/json"))
    throw fail(415, "Потрібні дані JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw fail(400, "Порожній запит.");
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 12000) {
      await reader.cancel();
      throw fail(413, "Запит завеликий.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw fail(400, "Некоректні дані замовлення.");
  }
}
const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const getOrder = (env, id) =>
  stmt(env, "SELECT * FROM orders WHERE id = ?", id).first();
function notification(env, order) {
  return stmt(
    env,
    "INSERT OR IGNORE INTO notifications (id,order_id,payload) SELECT ?,?,? FROM orders WHERE id=? AND digest=? AND status=? AND status IN ('awaiting_payment_on_delivery','success')",
    `${order.id}:${order.status}`,
    order.id,
    orderMessage(order),
    order.id,
    order.digest,
    order.status,
  );
}
function safePage(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["pay.mbnk.biz", "pay.monobank.ua"].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export function createWorker({ request = fetch } = {}) {
  let deliveryKey, delivery;
  async function mono(env, path, payload) {
    if (!env.MONO_API_TOKEN) throw fail(503, "Оплату ще не підключено.");
    const response = await request(
      "https://api.monobank.ua/api/merchant/" + path,
      {
        method: payload ? "POST" : "GET",
        headers: {
          "X-Token": env.MONO_API_TOKEN,
          "Content-Type": "application/json",
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok)
      throw fail(
        502,
        "Банк тимчасово не відповідає. Спробуйте перевірити статус пізніше.",
      );
    return response.json();
  }
  async function refresh(env, order) {
    if (!order.invoice_id) return order;
    const state = await mono(
      env,
      "invoice/status?invoiceId=" + encodeURIComponent(order.invoice_id),
    );
    if (
      state.invoiceId !== order.invoice_id ||
      state.amount !== order.amount ||
      state.ccy !== 980 ||
      !states.has(state.status)
    )
      throw fail(502, "Не вдалося підтвердити дані платежу.");
    const modified = Date.parse(state.modifiedDate || state.createdDate || "");
    if (!Number.isFinite(modified))
      throw fail(502, "Не вдалося перевірити час платежу.");
    const version = new Date(modified).toISOString();
    const next = { ...order, status: state.status, bank_modified: version };
    // Store the bank status and its notification atomically. Delayed bank responses
    // cannot regress a newer status or enqueue a stale notification.
    const update = stmt(
      env,
      "UPDATE orders SET status=?,bank_modified=?,checked_at=? WHERE id=? AND bank_modified<?",
      next.status,
      version,
      Date.now(),
      order.id,
      version,
    );
    await env.DB.batch(
      shouldNotify(next.status) ? [update, notification(env, next)] : [update],
    );
    await stmt(
      env,
      "UPDATE orders SET checked_at=? WHERE id=?",
      Date.now(),
      order.id,
    ).run();
    return getOrder(env, order.id);
  }

  async function flush(env, limit = 5) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
    for (let i = 0; i < limit; i++) {
      const now = Date.now(),
        lease = randomBytes(16).toString("hex");
      const task = await stmt(
        env,
        `UPDATE notifications SET lease_until=?,lease_token=? WHERE id=(SELECT n.id FROM notifications n JOIN orders o ON o.id=n.order_id WHERE n.sent_at IS NULL AND n.next_at<=? AND n.lease_until<=? AND o.status IN ('awaiting_payment_on_delivery','success') AND n.id=o.id||':'||o.status ORDER BY n.next_at LIMIT 1) AND lease_until<=? RETURNING *`,
        now + 60000,
        lease,
        now,
        now,
        now,
      ).first();
      if (!task) break;
      let retry = 0;
      try {
        const response = await request(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: task.payload,
              protect_content: true,
              link_preview_options: { is_disabled: true },
            }),
            signal: AbortSignal.timeout(12000),
          },
        );
        const result = await response.json();
        retry = Number(result.parameters?.retry_after) || 0;
        if (
          !response.ok ||
          !result.ok ||
          !Number.isInteger(result.result?.message_id)
        )
          throw new Error("delivery");
        await stmt(
          env,
          "UPDATE notifications SET sent_at=?,message_id=?,lease_until=0,lease_token=NULL WHERE id=? AND lease_token=?",
          Date.now(),
          result.result.message_id,
          task.id,
          lease,
        ).run();
      } catch {
        const delay = Math.max(
          retry * 1000,
          Math.min(900000, 30000 * 2 ** Math.min(task.attempts, 5)),
        );
        await stmt(
          env,
          "UPDATE notifications SET attempts=attempts+1,next_at=?,lease_until=0,lease_token=NULL WHERE id=? AND lease_token=?",
          Date.now() + delay,
          task.id,
          lease,
        ).run();
      }
    }
  }
  async function rate(env, req, kind, max) {
    const now = Date.now(),
      key = hash(
        sign(req.headers.get("CF-Connecting-IP") || "local", env) +
          kind +
          Math.floor(now / 60000),
      );
    const value = await stmt(
      env,
      `INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,
      key,
      now + 120000,
    ).first();
    if (value.count > max)
      throw fail(429, "Забагато запитів. Зачекайте хвилину.");
  }
  function publicOrder(order) {
    return {
      orderId: order.id,
      orderNumber: "MC-" + order.id.slice(0, 12).toUpperCase(),
      status: order.status,
      amount: order.amount,
      quantity: JSON.parse(order.details).quantity,
      ...(order.status === "awaiting_payment_on_delivery"
        ? {
            codFee: Math.round(order.amount * 0.02) + 2000,
            totalDue: order.amount + (Math.round(order.amount * 0.02) + 2000),
          }
        : {}),
      ...(pending.has(order.status) && safePage(order.page_url)
        ? { pageUrl: order.page_url }
        : {}),
    };
  }
  async function create(env, req, owner, url, cod) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)
      throw fail(503, "Прийом замовлень ще не налаштовано.");
    const input = await body(req),
      details = validateOrder(input.order);
    if (!uuid.test(input.requestId || ""))
      throw fail(400, "Некоректний номер запиту.");
    if (details.paymentMethod !== (cod ? "cod" : "online"))
      throw fail(400, "Перевірте спосіб оплати.");
    if (!cod && (!env.MONO_API_TOKEN || !env.WEBHOOK_SECRET))
      throw fail(503, "Оплату ще не підключено.");
    const id = hash(owner + input.requestId),
      digest = hash(JSON.stringify(details));
    const order = {
      id,
      owner,
      digest,
      details: JSON.stringify(details),
      amount: PRICE * details.quantity,
      status: cod ? "awaiting_payment_on_delivery" : "creating",
      created_at: Date.now(),
    };
    const insertion = stmt(
      env,
      `INSERT OR IGNORE INTO orders (id,owner,digest,details,amount,status,created_at) VALUES (?,?,?,?,?,?,?)`,
      id,
      owner,
      digest,
      order.details,
      order.amount,
      order.status,
      order.created_at,
    );
    // COD and its outbox entry are committed together; retries reuse the same order.
    const results = await env.DB.batch(
      cod ? [insertion, notification(env, order)] : [insertion],
    );
    if (!results[0].meta.changes) {
      const existing = await getOrder(env, id);
      if (existing.digest !== digest)
        throw fail(409, "Замовлення змінилося. Перевірте дані.");
      if (cod || existing.page_url) return publicOrder(existing);
      throw fail(
        409,
        "Рахунок уже створюється або потребує перевірки. Зверніться до продавця, не створюйте повторний платіж.",
      );
    }
    if (cod) return publicOrder(order);
    try {
      const redirect = new URL(env.SHOP_URL);
      redirect.searchParams.set("payment", id);
      const result = await mono(env, "invoice/create", {
        amount: order.amount,
        ccy: 980,
        paymentType: "debit",
        validity: 3600,
        redirectUrl: redirect.href,
        webHookUrl: `${url.origin}/api/payments/webhook/${env.WEBHOOK_SECRET}`,
        merchantPaymInfo: {
          reference: id,
          destination: "Магнітні Шахи",
          basketOrder: [
            {
              name: "Магнітні Шахи",
              icon: PRODUCT_IMAGE_URL,
              qty: details.quantity,
              sum: PRICE,
              total: order.amount,
              unit: "шт.",
              code: "magnetic-chess",
            },
          ],
        },
      });
      if (
        typeof result.invoiceId !== "string" ||
        !result.invoiceId ||
        !safePage(result.pageUrl)
      )
        throw fail(502, "Не вдалося перевірити посилання оплати.");
      Object.assign(order, {
        invoice_id: result.invoiceId,
        page_url: result.pageUrl,
        status: "created",
      });
      await stmt(
        env,
        "UPDATE orders SET invoice_id=?,page_url=?,status=? WHERE id=?",
        order.invoice_id,
        order.page_url,
        order.status,
        id,
      ).run();
      return publicOrder(order);
    } catch (error) {
      order.status = "creation_unconfirmed";
      await stmt(
        env,
        "UPDATE orders SET status=? WHERE id=?",
        order.status,
        id,
      ).run();
      throw error;
    }
  }
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url),
        origin = req.headers.get("Origin");
      const allowed = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((x) => x.trim());
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "Origin",
        "X-Content-Type-Options": "nosniff",
      };
      const send = (code, data) =>
        new Response(JSON.stringify(data), { status: code, headers });
      if (origin && allowed.includes(origin))
        Object.assign(headers, {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });
      try {
        if (!env.SESSION_SECRET || !env.DB)
          throw fail(503, "Магазин ще налаштовується.");
        if (url.pathname.startsWith("/api/payments/webhook/")) {
          if (
            req.method !== "POST" ||
            !env.WEBHOOK_SECRET ||
            url.pathname !== `/api/payments/webhook/${env.WEBHOOK_SECRET}`
          )
            throw fail(404, "Не знайдено.");
          await rate(env, req, "webhook", 120);
          const data = await body(req);
          if (typeof data.invoiceId !== "string")
            throw fail(400, "Некоректне повідомлення.");
          const order = await stmt(
            env,
            "SELECT * FROM orders WHERE invoice_id=?",
            data.invoiceId,
          ).first();
          if (order) await refresh(env, order);
          ctx.waitUntil(flush(env));
          return send(200, { ok: true });
        }
        if (!origin || !allowed.includes(origin))
          throw fail(403, "Запит не з магазину.");
        if (req.method === "OPTIONS")
          return new Response(null, { status: 204, headers });
        if (url.pathname === "/api/payments/config" && req.method === "GET") {
          await rate(env, req, "config", 30);
          return send(200, {
            mono: Boolean(env.MONO_API_TOKEN),
            delivery: Boolean(env.NOVA_POSHTA_API_KEY),
            telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
            sessionToken: session(req, env),
          });
        }
        const owner = ownerOf(req, env);
        if (url.pathname.startsWith("/api/delivery/") && req.method === "GET") {
          await rate(env, req, "delivery", 120);
          if (deliveryKey !== env.NOVA_POSHTA_API_KEY || !delivery) {
            deliveryKey = env.NOVA_POSHTA_API_KEY;
            delivery = createNovaPoshtaApi(deliveryKey, request);
          }
          let code = 200,
            result;
          await delivery(
            { method: "GET", url: url.href },
            {
              setHeader() {},
              set statusCode(v) {
                code = v;
              },
              end(v) {
                result = JSON.parse(v);
              },
            },
            () => {},
          );
          return send(code, result);
        }
        if (
          ["/api/payments/create", "/api/payments/cod"].includes(
            url.pathname,
          ) &&
          req.method === "POST"
        ) {
          await rate(env, req, "order", 10);
          try {
            return send(
              200,
              await create(env, req, owner, url, url.pathname.endsWith("/cod")),
            );
          } finally {
            ctx.waitUntil(flush(env));
          }
        }
        if (url.pathname === "/api/payments/status" && req.method === "GET") {
          await rate(env, req, "status", 60);
          const order = await getOrder(
            env,
            url.searchParams.get("orderId") || "",
          );
          if (!order || order.owner !== owner)
            throw fail(404, "Замовлення не знайдено у цій сесії.");
          const current =
            order.invoice_id && Date.now() - order.checked_at > 4500
              ? await refresh(env, order)
              : order;
          ctx.waitUntil(flush(env));
          return send(200, publicOrder(current));
        }
        throw fail(404, "Не знайдено.");
      } catch (e) {
        return send(e.code >= 400 && e.code <= 599 ? e.code : 502, {
          error:
            e.code >= 400 && e.code <= 599
              ? e.message
              : "Не вдалося обробити запит. Спробуйте пізніше.",
        });
      }
    },
    async scheduled(_event, env, ctx) {
      ctx.waitUntil(
        (async () => {
          // Inspect only interrupted creations, using the status index.
          const interrupted = await stmt(
            env,
            "SELECT * FROM orders WHERE status='creating' AND created_at<? LIMIT 10",
            Date.now() - 120000,
          ).all();
          for (const order of interrupted.results) {
            const next = { ...order, status: "creation_unconfirmed" };
            await stmt(
              env,
              "UPDATE orders SET status=? WHERE id=? AND status='creating'",
              next.status,
              next.id,
            ).run();
          }
          const rows = await stmt(
            env,
            `SELECT * FROM orders WHERE invoice_id IS NOT NULL AND status IN ('created','processing','hold') AND checked_at<? ORDER BY checked_at LIMIT 10`,
            Date.now() - 55000,
          ).all();
          for (const order of rows.results) {
            try {
              await refresh(env, order);
            } catch {
              await stmt(
                env,
                "UPDATE orders SET checked_at=? WHERE id=?",
                Date.now(),
                order.id,
              ).run();
            }
          }
          await flush(env, 10);
          await stmt(
            env,
            "DELETE FROM rate_limits WHERE expires_at<?",
            Date.now(),
          ).run();
        })(),
      );
    },
    flush,
  };
}
export default createWorker();
