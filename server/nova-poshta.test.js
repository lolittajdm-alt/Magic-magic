import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createNovaPoshtaApi } from "./nova-poshta.js";

async function harness(t, upstream) {
  const api = createNovaPoshtaApi("test-key", upstream);
  const server = http.createServer((req, res) =>
    api(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path) => {
    const response = await fetch(base + path);
    return { status: response.status, data: await response.json() };
  };
}
test("delivery validates city selection and omits closed warehouses", async (t) => {
  const city = "11111111-1111-1111-1111-111111111111";
  let calls = 0;
  const get = await harness(t, async (_, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.methodProperties.CityRef, city);
    return Response.json({
      success: true,
      data: [
        {
          Ref: "open",
          Description: "Відділення 1",
          CityRef: city,
          WarehouseStatus: "Working",
        },
        { Ref: "closed", WarehouseStatus: "Closed" },
      ],
    });
  });
  assert.equal(
    (await get("/api/delivery/warehouses?city=invalid")).status,
    400,
  );
  assert.deepEqual((await get("/api/delivery/cities?q=a")).data, { items: [] });
  const path = "/api/delivery/warehouses?city=" + city;
  assert.equal((await get(path)).data.items.length, 1);
  assert.equal((await get(path)).data.items[0].cityRef, city);
  assert.equal(calls, 1);
});
test("upstream delivery failures do not expose internal errors", async (t) => {
  const get = await harness(t, async () => {
    throw Error("private-upstream-detail");
  });
  const result = await get("/api/delivery/cities?q=Київ");
  assert.equal(result.status, 502);
  assert.ok(!result.data.error.includes("private-upstream-detail"));
});
