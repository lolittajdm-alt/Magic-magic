import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createPaymentApi } from "./payments.js";
const origin = "http://127.0.0.1:5173";
const order = {
  quantity: 2,
  first: "Тест",
  last: "Тест",
  phone: "+380671234567",
  city: { ref: "11111111-1111-1111-1111-111111111111", name: "Київ" },
  warehouse: {
    ref: "22222222-2222-2222-2222-222222222222",
    cityRef: "11111111-1111-1111-1111-111111111111",
    name: "Відділення 1",
  },
};
async function harness(t, upstream) {
  const dir = await mkdtemp(join(tmpdir(), "chess-payment-test-"));
  const options = {
    token: "test-only-token",
    origin,
    dataDir: dir,
    request: upstream,
  };
  let api = createPaymentApi(options);
  const server = http.createServer((req, res) =>
    api(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const config = await fetch(base + "/api/payments/config");
  const cookie = config.headers.get("set-cookie").split(";")[0];
  return {
    dir,
    restart: () => {
      api = createPaymentApi(options);
    },
    call: async (path, body, headers = {}) => {
      const r = await fetch(base + "/api/payments/" + path, {
        method: body ? "POST" : "GET",
        headers: {
          cookie,
          origin,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { code: r.status, data: await r.json() };
    },
  };
}
test("server sets price, persists delivery, deduplicates concurrent/restarted requests and verifies status", async (t) => {
  let creates = 0,
    amount;
  const h = await harness(t, async (url, options) => {
    if (url.endsWith("invoice/create")) {
      creates++;
      const b = JSON.parse(options.body);
      amount = b.amount;
      assert.equal(b.merchantPaymInfo.basketOrder[0].sum, 1000);
      assert.equal(
        b.merchantPaymInfo.basketOrder[0].icon,
        "https://lolittajdm-alt.github.io/Magic-magic/assets/checkout-product.webp",
      );
      assert.equal(b.ccy, 980);
      return Response.json({
        invoiceId: "test-invoice",
        pageUrl: "https://pay.mbnk.biz/test-invoice",
      });
    }
    return Response.json({
      invoiceId: "test-invoice",
      amount,
      ccy: 980,
      status: "success",
    });
  });
  const body = { requestId: randomUUID(), order: { ...order, amount: 1 } };
  const results = await Promise.all([
    h.call("create", body),
    h.call("create", body),
  ]);
  assert.equal(results[0].code, 200);
  assert.equal(results[1].data.orderId, results[0].data.orderId);
  assert.equal(creates, 1);
  assert.equal(amount, 2000);
  h.restart();
  assert.equal((await h.call("create", body)).code, 200);
  assert.equal(creates, 1);
  const id = results[0].data.orderId;
  const saved = JSON.parse(await readFile(join(h.dir, id + ".json"), "utf8"));
  assert.equal(saved.warehouse.name, order.warehouse.name);
  assert.equal((await h.call("status?orderId=" + id)).data.status, "success");
  assert.equal(
    (await h.call("status?orderId=" + id, null, { cookie: "" })).code,
    404,
  );
  assert.equal(
    (await h.call("create", { ...body, order: { ...order, quantity: 3 } }))
      .code,
    409,
  );
});
test("rejects invalid quantity, mismatched warehouse, and cross-origin creation without calling bank", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    throw Error("must not run");
  });
  for (const quantity of [0, 11, 1.5, "2"])
    assert.equal(
      (
        await h.call("create", {
          requestId: randomUUID(),
          order: { ...order, quantity },
        })
      ).code,
      400,
    );
  assert.equal(
    (
      await h.call("create", {
        requestId: randomUUID(),
        order: {
          ...order,
          warehouse: { ...order.warehouse, cityRef: randomUUID() },
        },
      })
    ).code,
    400,
  );
  assert.equal(
    (
      await h.call(
        "create",
        { requestId: randomUUID(), order },
        { origin: "https://other.example" },
      )
    ).code,
    403,
  );
  assert.equal(calls, 0);
});
test("ambiguous bank failure cannot silently create duplicate invoices", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    throw Error("timeout");
  });
  const body = { requestId: randomUUID(), order };
  assert.equal((await h.call("create", body)).code, 502);
  h.restart();
  assert.equal((await h.call("create", body)).code, 409);
  assert.equal(calls, 1);
});
test("rejects unexpected bank redirects and never reports mismatched amount as paid", async (t) => {
  const h = await harness(t, async (url) =>
    url.endsWith("create")
      ? Response.json({
          invoiceId: "test-invoice",
          pageUrl: "https://pay.mbnk.biz/test-invoice",
        })
      : Response.json({
          invoiceId: "test-invoice",
          amount: 1,
          ccy: 980,
          status: "success",
        }),
  );
  const created = await h.call("create", { requestId: randomUUID(), order });
  assert.equal(
    (await h.call("status?orderId=" + created.data.orderId)).code,
    502,
  );
  const bad = await harness(t, async () =>
    Response.json({ invoiceId: "x", pageUrl: "https://evil.example/pay" }),
  );
  assert.equal(
    (await bad.call("create", { requestId: randomUUID(), order })).code,
    502,
  );
});

test("COD persists unpaid order and server-calculated fee, deduplicates retries without calling mono", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    throw Error("COD must not contact bank");
  });
  const body = {
    requestId: randomUUID(),
    order: { ...order, paymentMethod: "cod", amount: 1, codFee: 0 },
  };
  const results = await Promise.all([h.call("cod", body), h.call("cod", body)]);
  assert.equal(results[0].code, 200);
  assert.deepEqual(results[0].data, results[1].data);
  const result = results[0].data;
  assert.equal(result.status, "awaiting_payment_on_delivery");
  assert.equal(result.amount, 2000);
  assert.equal(result.codFee, 2040);
  assert.equal(result.totalDue, 4040);
  assert.match(result.orderNumber, /^MC-[A-F0-9]{12}$/);
  h.restart();
  assert.deepEqual((await h.call("cod", body)).data, result);
  const saved = JSON.parse(
    await readFile(join(h.dir, result.orderId + ".json"), "utf8"),
  );
  assert.equal(saved.paymentMethod, "cod");
  assert.equal(saved.phone, order.phone);
  assert.equal(saved.invoiceId, undefined);
  assert.equal((await readdir(h.dir)).length, 1);
  assert.equal(
    (await h.call("cod", { ...body, order: { ...body.order, quantity: 3 } }))
      .code,
    409,
  );
  assert.equal((await h.call("create", body)).code, 400);
  assert.equal(
    (await h.call("cod", { requestId: randomUUID(), order })).code,
    400,
  );
  assert.equal(
    (await h.call("cod", body, { origin: "https://other.example" })).code,
    403,
  );
  assert.equal(
    (
      await h.call("cod", {
        requestId: randomUUID(),
        order: { ...body.order, phone: "bad" },
      })
    ).code,
    400,
  );
  assert.equal(
    (await h.call("status?orderId=" + result.orderId)).data.status,
    "awaiting_payment_on_delivery",
  );
  assert.equal(calls, 0);
});

test("rejects non-object JSON bodies without contacting bank", async (t) => {
  let calls = 0;
  const h = await harness(t, async () => {
    calls++;
    throw Error("must not run");
  });
  for (const body of [[], "invalid", 42]) {
    assert.equal((await h.call("create", body)).code, 400);
  }
  assert.equal(calls, 0);
});
