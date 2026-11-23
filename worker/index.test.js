import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createWorker } from "./index.js";
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("./migrations/0001_orders.sql", import.meta.url),
      "utf8",
    ),
  );
  function prepare(sql) {
    let args = [];
    return {
      bind(...v) {
        args = v;
        return this;
      },
      async first() {
        return db.prepare(sql).get(...args) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...args) };
      },
      async run() {
        const r = db.prepare(sql).run(...args);
        return { meta: { changes: Number(r.changes) } };
      },
    };
  }
  return {
    prepare,
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    db,
  };
}
const city = "8d5a980d-391c-11dd-90d9-001a92567626";
const details = {
  quantity: 2,
  first: "Тест",
  last: "Перевірка",
  phone: "+380501234567",
  paymentMethod: "cod",
  city: { ref: city, name: "Київ" },
  warehouse: {
    ref: "11111111-1111-1111-1111-111111111111",
    name: "Відділення №1",
    cityRef: city,
  },
  contactRequested: false,
};
async function fixture() {
  const DB = database(),
    tasks = [],
    calls = [];
  let telegramFail = false,
    bankStatus = "created",
    badAmount = false;
  const env = {
    DB,
    SESSION_SECRET: "test-secret-only",
    WEBHOOK_SECRET: "test-webhook",
    TELEGRAM_BOT_TOKEN: "test-bot",
    TELEGRAM_CHAT_ID: "123",
    MONO_API_TOKEN: "test-mono",
    NOVA_POSHTA_API_KEY: "test-np",
    ALLOWED_ORIGINS: "https://shop.example",
    SHOP_URL: "https://shop.example/Magic-magic/",
  };
  const worker = createWorker({
    request: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("api.telegram.org"))
        return Response.json(
          telegramFail
            ? { ok: false }
            : { ok: true, result: { message_id: 42 } },
          { status: telegramFail ? 503 : 200 },
        );
      if (url.endsWith("invoice/create"))
        return Response.json({
          invoiceId: "invoice-1",
          pageUrl: "https://pay.mbnk.biz/test",
        });
      if (url.includes("invoice/status"))
        return Response.json({
          invoiceId: "invoice-1",
          amount: badAmount ? 1 : 2000,
          ccy: 980,
          status: bankStatus,
          modifiedDate:
            bankStatus === "success"
              ? "2026-11-23T15:00:00Z"
              : "2026-11-23T14:00:00Z",
        });
      if (url.includes("novaposhta"))
        return Response.json({
          success: true,
          data: [{ Ref: city, Description: "Київ" }],
        });
      throw new Error("unexpected");
    },
  });
  const ctx = {
    waitUntil(p) {
      tasks.push(p);
    },
  };
  async function drain() {
    await Promise.all(tasks.splice(0));
  }
  async function call(
    path,
    { token, method = "GET", data, origin = "https://shop.example" } = {},
  ) {
    return worker.fetch(
      new Request("https://worker.example" + path, {
        method,
        headers: {
          ...(origin ? { Origin: origin } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
      ctx,
    );
  }
  const config = await (await call("/api/payments/config")).json();
  return {
    worker,
    env,
    DB,
    calls,
    call,
    drain,
    token: config.sessionToken,
    setTelegramFail(v) {
      telegramFail = v;
    },
    setBank(v) {
      bankStatus = v;
    },
    setBadAmount(v) {
      badAmount = v;
    },
  };
}
test("COD persists one order, sends Telegram automatically, and rejects changed duplicate", async () => {
  const f = await fixture(),
    requestId = randomUUID();
  const submit = (order) =>
    f.call("/api/payments/cod", {
      method: "POST",
      token: f.token,
      data: { requestId, order },
    });
  const response = await submit(details);
  assert.equal(response.status, 200);
  const order = await response.json();
  await f.drain();
  assert.equal(order.amount, 2000);
  assert.equal(order.codFee, 2040);
  assert.equal(order.totalDue, 4040);
  assert.equal((await submit(details)).status, 200);
  await f.drain();
  assert.equal((await submit({ ...details, quantity: 3 })).status, 409);
  await f.drain();
  assert.equal(f.DB.db.prepare("SELECT count(*) AS n FROM orders").get().n, 1);
  assert.equal(f.calls.filter((c) => c.url.includes("telegram")).length, 1);
  assert.match(JSON.parse(f.calls[0].init.body).text, /ще не оплачено/);
  assert.match(
    JSON.parse(f.calls[0].init.body).text,
    /Комісія переказу \(2% \+ 20\.00 ₴\): 20\.40 грн/,
  );
  assert.match(
    JSON.parse(f.calls[0].init.body).text,
    /Разом без доставки: 40\.40 грн/,
  );
});
test("failed Telegram delivery remains in durable outbox and is retried", async () => {
  const f = await fixture();
  f.setTelegramFail(true);
  assert.equal(
    (
      await f.call("/api/payments/cod", {
        method: "POST",
        token: f.token,
        data: { requestId: randomUUID(), order: details },
      })
    ).status,
    200,
  );
  await f.drain();
  const queued = f.DB.db.prepare("SELECT * FROM notifications").get();
  assert.equal(queued.sent_at, null);
  assert.equal(queued.attempts, 1);
  f.DB.db.exec("UPDATE notifications SET next_at=0");
  f.setTelegramFail(false);
  await f.worker.flush(f.env);
  assert.ok(f.DB.db.prepare("SELECT sent_at FROM notifications").get().sent_at);
});
test("origin, session, ownership and invalid delivery are enforced", async () => {
  const f = await fixture();
  assert.equal(
    (await f.call("/api/payments/config", { origin: "https://evil.example" }))
      .status,
    403,
  );
  assert.equal((await f.call("/api/delivery/cities?q=Київ")).status, 401);
  assert.equal(
    (
      await f.call("/api/delivery/cities?q=Київ", {
        token: f.token.slice(0, -1) + "x",
      })
    ).status,
    401,
  );
  const r = await f.call("/api/payments/cod", {
    method: "POST",
    token: f.token,
    data: { requestId: randomUUID(), order: details },
  });
  const order = await r.json();
  await f.drain();
  const other = await (await f.call("/api/payments/config")).json();
  assert.equal(
    (
      await f.call("/api/payments/status?orderId=" + order.orderId, {
        token: other.sessionToken,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call("/api/payments/cod", {
        method: "POST",
        token: f.token,
        data: {
          requestId: randomUUID(),
          order: {
            ...details,
            warehouse: { ...details.warehouse, cityRef: randomUUID() },
          },
        },
      })
    ).status,
    400,
  );
});
test("mono invoice uses server price, correct return path and webhook, repeated request creates no second invoice", async () => {
  const f = await fixture(),
    requestId = randomUUID(),
    order = { ...details, paymentMethod: "online", amount: 1 };
  const submit = () =>
    f.call("/api/payments/create", {
      method: "POST",
      token: f.token,
      data: { requestId, order },
    });
  const r = await submit();
  assert.equal(r.status, 200);
  const result = await r.json();
  await f.drain();
  assert.equal((await submit()).status, 200);
  await f.drain();
  const invoices = f.calls.filter((c) => c.url.endsWith("invoice/create"));
  assert.equal(invoices.length, 1);
  const data = JSON.parse(invoices[0].init.body);
  assert.equal(data.amount, 2000);
  assert.equal(
    data.merchantPaymInfo.basketOrder[0].icon,
    "https://lolittajdm-alt.github.io/Magic-magic/assets/checkout-product.webp",
  );
  assert.ok(
    data.redirectUrl.startsWith("https://shop.example/Magic-magic/?payment="),
  );
  assert.match(data.webHookUrl, /webhook\/test-webhook$/);
  assert.equal(result.pageUrl, "https://pay.mbnk.biz/test");
});
test("webhook cannot declare payment successful without bank confirmation", async () => {
  const f = await fixture();
  await f.call("/api/payments/create", {
    method: "POST",
    token: f.token,
    data: {
      requestId: randomUUID(),
      order: { ...details, paymentMethod: "online" },
    },
  });
  await f.drain();
  const webhook = () =>
    f.call("/api/payments/webhook/test-webhook", {
      method: "POST",
      origin: null,
      data: { invoiceId: "invoice-1", status: "success" },
    });
  assert.equal((await webhook()).status, 200);
  await f.drain();
  assert.equal(
    f.DB.db.prepare("SELECT status FROM orders").get().status,
    "created",
  );
  f.setBank("success");
  f.setBadAmount(true);
  assert.equal((await webhook()).status, 502);
  await f.drain();
  assert.equal(
    f.DB.db.prepare("SELECT status FROM orders").get().status,
    "created",
  );
  f.setBadAmount(false);
  assert.equal((await webhook()).status, 200);
  await f.drain();
  assert.equal(
    f.DB.db.prepare("SELECT status FROM orders").get().status,
    "success",
  );
  f.setBank("created");
  await webhook();
  await f.drain();
  assert.equal(
    f.DB.db.prepare("SELECT status FROM orders").get().status,
    "success",
  );
});
test("city search uses private key and returns suggestions", async () => {
  const f = await fixture();
  const r = await f.call("/api/delivery/cities?q=Київ", { token: f.token });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).items[0].name, "Київ");
});

test("ambiguous invoice creation never retries the bank call", async () => {
  const f = await fixture();
  const key = randomUUID();
  const order = { ...details, paymentMethod: "online" };
  const first = await f.call("/api/payments/create", {
    method: "POST",
    token: f.token,
    data: { requestId: key, order },
  });
  await first.json();
  await f.drain();
  f.DB.db.exec(
    "UPDATE orders SET status='creating', page_url=NULL, invoice_id=NULL",
  );
  assert.equal(
    (
      await f.call("/api/payments/create", {
        method: "POST",
        token: f.token,
        data: { requestId: key, order },
      })
    ).status,
    409,
  );
  await f.drain();
  assert.equal(
    f.calls.filter((c) => c.url.endsWith("invoice/create")).length,
    1,
  );
});

test("request size and rate limits stop excessive submissions", async () => {
  const f = await fixture();
  assert.equal(
    (
      await f.call("/api/payments/cod", {
        method: "POST",
        token: f.token,
        data: {
          requestId: randomUUID(),
          order: details,
          extra: "x".repeat(13000),
        },
      })
    ).status,
    413,
  );
  for (let i = 0; i < 9; i++)
    await f.call("/api/payments/cod", {
      method: "POST",
      token: f.token,
      data: {},
    });
  assert.equal(
    (
      await f.call("/api/payments/cod", {
        method: "POST",
        token: f.token,
        data: {},
      })
    ).status,
    429,
  );
  await f.drain();
  assert.equal(f.calls.length, 0);
});

test("scheduled reconciliation confirms a paid invoice without a browser return", async () => {
  const f = await fixture();
  await f.call("/api/payments/create", {
    method: "POST",
    token: f.token,
    data: {
      requestId: randomUUID(),
      order: { ...details, paymentMethod: "online" },
    },
  });
  await f.drain();
  f.setBank("success");
  let job;
  await f.worker.scheduled({}, f.env, {
    waitUntil(p) {
      job = p;
    },
  });
  await job;
  assert.equal(
    f.DB.db.prepare("SELECT status FROM orders").get().status,
    "success",
  );
  assert.equal(
    f.DB.db
      .prepare(
        "SELECT sent_at IS NOT NULL AS delivered FROM notifications WHERE id LIKE '%:success'",
      )
      .get().delivered,
    1,
  );
});

test("online order is silent until authoritative bank success; repeated callbacks send once", async () => {
  const f = await fixture();
  await f.call("/api/payments/create", {
    method: "POST",
    token: f.token,
    data: {
      requestId: randomUUID(),
      order: { ...details, paymentMethod: "online" },
    },
  });
  await f.drain();
  const sent = () => f.calls.filter((c) => c.url.includes("telegram"));
  assert.equal(sent().length, 0);
  assert.equal(
    f.DB.db.prepare("SELECT count(*) AS n FROM notifications").get().n,
    0,
  );
  const webhook = () =>
    f.call("/api/payments/webhook/test-webhook", {
      method: "POST",
      origin: null,
      data: { invoiceId: "invoice-1", status: "success" },
    });
  await webhook();
  await f.drain();
  assert.equal(sent().length, 0);
  f.setBank("success");
  f.setBadAmount(true);
  await webhook();
  await f.drain();
  assert.equal(sent().length, 0);
  f.setBadAmount(false);
  await webhook();
  await f.drain();
  assert.equal(sent().length, 1);
  assert.match(
    JSON.parse(sent()[0].init.body).text,
    /Оплату підтверджено банком/,
  );
  await webhook();
  await f.drain();
  assert.equal(sent().length, 1);
});

for (const status of [
  "created",
  "processing",
  "hold",
  "failure",
  "expired",
  "reversed",
]) {
  test(`online ${status} does not send an order to Telegram`, async () => {
    const f = await fixture();
    await f.call("/api/payments/create", {
      method: "POST",
      token: f.token,
      data: {
        requestId: randomUUID(),
        order: { ...details, paymentMethod: "online" },
      },
    });
    await f.drain();
    f.setBank(status);
    await f.call("/api/payments/webhook/test-webhook", {
      method: "POST",
      origin: null,
      data: { invoiceId: "invoice-1", status: "success" },
    });
    await f.drain();
    assert.equal(f.calls.filter((c) => c.url.includes("telegram")).length, 0);
    assert.equal(
      f.DB.db.prepare("SELECT count(*) AS n FROM notifications").get().n,
      0,
    );
  });
}

test("legacy queued notifications for unpaid online invoices are not delivered after upgrade", async () => {
  const f = await fixture();
  const r = await f.call("/api/payments/create", {
    method: "POST",
    token: f.token,
    data: {
      requestId: randomUUID(),
      order: { ...details, paymentMethod: "online" },
    },
  });
  const order = await r.json();
  await f.drain();
  f.DB.db
    .prepare("INSERT INTO notifications (id,order_id,payload) VALUES (?,?,?)")
    .run(order.orderId + ":created", order.orderId, "Old unpaid notification");
  await f.worker.flush(f.env);
  assert.equal(f.calls.filter((c) => c.url.includes("telegram")).length, 0);
});
