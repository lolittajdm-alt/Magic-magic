export const TELEGRAM_SELLER = "chabaniuk_vladyslav";
const line = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim();
const money = (amount) => `${amount.toFixed(2)} грн`;

export function buildTelegramOrder(order, unitPrice) {
  const subtotal = Math.round(unitPrice * order.quantity * 100) / 100;
  const fee = Math.round(subtotal * 0.02 * 100) / 100 + 20;
  return [
    "Вітаю! Хочу замовити гру «Магнітні Шахи».",
    `Кількість: ${order.quantity} шт.`,
    `Ціна за набір: ${money(unitPrice)}`,
    `Сума товарів: ${money(subtotal)}`,
    "",
    `Отримувач: ${line(order.first)} ${line(order.last)}`,
    `Телефон: ${line(order.phone)}`,
    `Нова пошта · ${line(order.city?.name)}`,
    `Відділення / поштомат: ${line(order.warehouse?.name)}`,
    `Зателефонувати для уточнення: ${order.contactRequested ? "так" : "ні"}`,
    "",
    "Оплата при отриманні. Замовлення ще не оплачено.",
    `Комісія переказу (2% + 20.00 ₴): ${money(fee)}`,
    `Разом без доставки: ${money(subtotal + fee)}`,
    "Доставка оплачується окремо.",
    "Будь ласка, підтвердьте наявність, вартість і деталі замовлення.",
  ].join("\n");
}

export function telegramOrderUrl(text) {
  return `https://t.me/${TELEGRAM_SELLER}?text=${encodeURIComponent(text)}`;
}
