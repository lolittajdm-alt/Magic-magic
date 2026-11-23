const REF = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
export function createNovaPoshtaApi(apiKey, request = fetch) {
  const cache = new Map();
  async function call(method, properties) {
    if (!apiKey)
      throw new Error("Доставку ще не налаштовано. Спробуйте пізніше.");
    const key = JSON.stringify([method, properties]);
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.data;
    const response = await request("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "Address",
        calledMethod: method,
        methodProperties: properties,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error("Нова пошта тимчасово недоступна. Спробуйте ще раз.");
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data))
      throw new Error(
        "Не вдалося отримати дані Нової пошти. Спробуйте ще раз.",
      );
    if (cache.size > 300) cache.clear();
    cache.set(key, { data: result.data, until: Date.now() + 300000 });
    return result.data;
  }
  return async function middleware(req, res, next) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const send = (code, data) => {
      res.statusCode = code;
      res.end(JSON.stringify(data));
    };
    if (req.method !== "GET")
      return send(405, { error: "Метод не підтримується." });
    const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
    try {
      if (url.pathname === "/api/delivery/cities") {
        if (query.length < 2) return send(200, { items: [] });
        const data = await call("getCities", {
          FindByString: query,
          Limit: "30",
          Page: "1",
        });
        return send(200, {
          items: data.map((c) => ({
            ref: c.Ref,
            name: c.Description,
            detail: [c.AreaDescription, c.SettlementTypeDescription]
              .filter(Boolean)
              .join(" · "),
          })),
        });
      }
      if (url.pathname === "/api/delivery/warehouses") {
        const cityRef = url.searchParams.get("city");
        if (!REF.test(cityRef || ""))
          return send(400, { error: "Спочатку оберіть місто зі списку." });
        const data = await call("getWarehouses", {
          CityRef: cityRef,
          FindByString: query,
          Limit: "50",
          Page: "1",
          Language: "UA",
        });
        return send(200, {
          items: data
            .filter(
              (w) => !w.WarehouseStatus || w.WarehouseStatus === "Working",
            )
            .map((w) => ({
              ref: w.Ref,
              name: w.Description,
              detail: w.ShortAddress,
              cityRef: w.CityRef,
            })),
        });
      }
      return send(404, { error: "Сторінку не знайдено." });
    } catch (error) {
      return send(502, {
        error:
          error.name === "TimeoutError"
            ? "Нова пошта відповідає довше, ніж зазвичай. Повторіть пошук."
            : error.message.startsWith("Нова") ||
                error.message.startsWith("Не вдалося") ||
                error.message.startsWith("Доставку")
              ? error.message
              : "Не вдалося завантажити дані. Перевірте з’єднання та спробуйте ще раз.",
      });
    }
  };
}
