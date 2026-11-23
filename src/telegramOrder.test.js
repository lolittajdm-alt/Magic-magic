import test from "node:test";
import assert from "node:assert/strict";
import { buildTelegramOrder, telegramOrderUrl } from "./telegramOrder.js";

test("personal Telegram draft preserves delivery, callback and unpaid totals", () => {
  const text = buildTelegramOrder(
    {
      quantity: 2,
      first: "  Ім’я  ",
      last: "Тест\nперевірка",
      phone: "+380671234567",
      city: { name: "Київ" },
      warehouse: { name: "№ 1 & поштомат #2" },
      contactRequested: true,
    },
    10,
  );
  assert.match(text, /Сума товарів: 20\.00 грн/);
  assert.match(text, /Разом без доставки: 40\.40 грн/);
  assert.match(text, /ще не оплачено/);
  assert.match(text, /Отримувач: Ім’я Тест перевірка/);
  assert.match(text, /Зателефонувати для уточнення: так/);
  const url = new URL(telegramOrderUrl(text));
  assert.equal(url.origin, "https://t.me");
  assert.equal(url.pathname, "/chabaniuk_vladyslav");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.hash, "");
  assert.equal([...url.searchParams].length, 1);
});
