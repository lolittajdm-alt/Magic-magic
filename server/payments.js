import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

import { PRICE, PRODUCT_IMAGE_URL, validateOrder } from "./order.js";
export { validateOrder } from "./order.js";
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code, message) => Object.assign(new Error(message), { code });
export function createPaymentApi({
  token,
  origin = "http://127.0.0.1:5173",
  dataDir = join(process.cwd(), ".data", "orders"),
  request = fetch,
}) {
  origin = new URL(origin).origin;
  const locks = new Map(),
    limits = new Map();
  async function save(order) {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const path = join(dataDir, order.id + ".json"),
      temp = path + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(order), { mode: 0o600 });
    await rename(temp, path);
  }
  async function load(id) {
    if (!/^[a-f\d]{64}$/.test(id)) throw fail(404, "Замовлення не знайдено.");
    try {
      return JSON.parse(await readFile(join(dataDir, id + ".json"), "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  async function mono(path, body) {
    if (!token) throw fail(503, "Оплату тимчасово не налаштовано.");
    const response = await request(
      "https://api.monobank.ua/api/merchant/" + path,
      {
        method: body ? "POST" : "GET",
        headers: { "X-Token": token, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw fail(502, "Не вдалося зв’язатися з mono. Спробуйте пізніше.");
    return response.json();
  }
  function paymentUrl(url) {
    try {
      const u = new URL(url);
      return (
        u.protocol === "https:" &&
        ["pay.mbnk.biz", "pay.monobank.ua"].includes(u.hostname) &&
        !u.username &&
        !u.password
      );
    } catch {
      return false;
    }
  }
  async function body(req) {
    if (!(req.headers["content-type"] || "").startsWith("application/json"))
      throw fail(415, "Очікується JSON.");
    let text = "";
    for await (const part of req) {
      text += part;
      if (Buffer.byteLength(text) > 12000) throw fail(413, "Забагато даних.");
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw Error("invalid body");
      return parsed;
    } catch {
      throw fail(400, "Невірний запит.");
    }
  }
  function session(req, res) {
    let sid = (req.headers.cookie || "").match(
      /(?:^|;\s*)chess_session=([a-f\d]{64})(?:;|$)/,
    )?.[1];
    if (!sid) {
      sid = randomBytes(32).toString("hex");
      res.setHeader(
        "Set-Cookie",
        `chess_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${origin.startsWith("https:") ? "; Secure" : ""}`,
      );
    }
    return hash(sid);
  }
  async function create(owner, key, input) {
    if (!token) throw fail(503, "Оплату тимчасово не налаштовано.");
    const details = validateOrder(input),
      id = hash(owner + key),
      digest = hash(JSON.stringify(details));
    if (details.paymentMethod !== "online")
      throw fail(400, "Для оплати при отриманні підтвердіть замовлення.");
    const previous = await load(id);
    if (previous) {
      if (previous.digest !== digest)
        throw fail(409, "Замовлення змінилося. Перевірте дані ще раз.");
      if (previous.pageUrl) return { orderId: id, pageUrl: previous.pageUrl };
      throw fail(
        409,
        "Рахунок уже створюється або очікує перевірки. Не повторюйте оплату; зверніться до продавця.",
      );
    }
    const order = {
      id,
      owner,
      digest,
      ...details,
      amount: PRICE * details.quantity,
      ccy: 980,
      createdAt: new Date().toISOString(),
      status: "creating",
    };
    await save(order);
    try {
      const result = await mono("invoice/create", {
        amount: order.amount,
        ccy: 980,
        paymentType: "debit",
        validity: 3600,
        redirectUrl: `${origin}/?payment=${id}`,
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
        !paymentUrl(result.pageUrl)
      )
        throw fail(502, "mono повернув некоректне посилання.");
      Object.assign(order, {
        invoiceId: result.invoiceId,
        pageUrl: result.pageUrl,
        status: "created",
      });
      await save(order);
      return { orderId: id, pageUrl: order.pageUrl };
    } catch (e) {
      // A timed-out request may still create an invoice: never create another automatically.
      order.status = "creation_unconfirmed";
      await save(order);
      throw e;
    }
  }
  async function confirmCod(owner, key, input) {
    const details = validateOrder(input);
    if (details.paymentMethod !== "cod")
      throw fail(400, "Оберіть оплату при отриманні.");
    const id = hash(owner + key),
      digest = hash(JSON.stringify(details));
    const previous = await load(id);
    if (previous && previous.digest !== digest)
      throw fail(409, "Замовлення змінилося. Перевірте дані ще раз.");
    const amount = PRICE * details.quantity;
    const order = previous || {
      id,
      owner,
      digest,
      ...details,
      amount,
      ccy: 980,
      codFee: Math.round(amount * 0.02) + 2000,
      orderNumber: "MC-" + id.slice(0, 12).toUpperCase(),
      status: "awaiting_payment_on_delivery",
      createdAt: new Date().toISOString(),
    };
    if (!previous) await save(order);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      amount: order.amount,
      codFee: order.codFee,
      totalDue: order.amount + order.codFee,
    };
  }
  return async function payments(req, res, next) {
    const url = new URL(req.url, origin);
    if (!url.pathname.startsWith("/api/payments/")) return next();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const send = (code, data) => {
      res.statusCode = code;
      res.end(JSON.stringify(data));
    };
    try {
      if (req.headers.origin && req.headers.origin !== origin)
        throw fail(403, "Запит з іншого сайту заборонено.");
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw fail(403, "Запит з іншого сайту заборонено.");
      const owner = session(req, res);
      if (url.pathname === "/api/payments/config" && req.method === "GET")
        return send(200, { mono: Boolean(token) });
      if (
        ["/api/payments/create", "/api/payments/cod"].includes(url.pathname) &&
        req.method === "POST"
      ) {
        if (req.headers.origin !== origin)
          throw fail(403, "Невірне джерело запиту.");
        const input = await body(req);
        if (!UUID.test(input.requestId || ""))
          throw fail(400, "Невірний ідентифікатор запиту.");
        const lockKey = hash(owner + input.requestId);
        const fingerprint = hash(url.pathname + JSON.stringify(input.order));
        if (locks.has(lockKey)) {
          const lock = locks.get(lockKey);
          if (lock.fingerprint !== fingerprint)
            throw fail(409, "Замовлення змінилося. Перевірте дані ще раз.");
          return send(200, await lock.pending);
        }
        const ip = req.socket.remoteAddress || "local",
          now = Date.now();
        for (const [key, hit] of limits)
          if (hit.until < now) limits.delete(key);
        const limit = limits.get(ip) || { count: 0, until: now + 60000 };
        if (++limit.count > 15)
          throw fail(429, "Забагато спроб. Зачекайте хвилину.");
        limits.set(ip, limit);
        const pending = (
          url.pathname === "/api/payments/cod" ? confirmCod : create
        )(owner, input.requestId, input.order);
        locks.set(lockKey, { fingerprint, pending });
        try {
          return send(200, await pending);
        } finally {
          locks.delete(lockKey);
        }
      }
      if (url.pathname === "/api/payments/status" && req.method === "GET") {
        const order = await load(url.searchParams.get("orderId") || "");
        if (!order || order.owner !== owner)
          throw fail(404, "Замовлення не знайдено в цій сесії.");
        if (order.invoiceId) {
          const state = await mono(
            "invoice/status?invoiceId=" + encodeURIComponent(order.invoiceId),
          );
          if (
            state.invoiceId !== order.invoiceId ||
            state.amount !== order.amount ||
            state.ccy !== 980
          )
            throw fail(502, "Не вдалося підтвердити суму платежу.");
          const statuses = [
            "created",
            "processing",
            "hold",
            "success",
            "failure",
            "reversed",
            "expired",
          ];
          if (!statuses.includes(state.status))
            throw fail(502, "Невідомий статус платежу.");
          order.status = state.status;
          order.checkedAt = new Date().toISOString();
          await save(order);
        }
        return send(200, {
          orderId: order.id,
          status: order.status,
          amount: order.amount,
          quantity: order.quantity,
          pageUrl: ["created", "failure"].includes(order.status)
            ? order.pageUrl
            : null,
        });
      }
      return send(405, { error: "Метод не підтримується." });
    } catch (e) {
      return send(e.code >= 400 && e.code <= 599 ? e.code : 502, {
        error:
          e.code >= 400 && e.code <= 599
            ? e.message
            : "Не вдалося перевірити оплату. Спробуйте пізніше.",
      });
    }
  };
}
