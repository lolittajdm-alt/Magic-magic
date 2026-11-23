const labels = {
  awaiting_payment_on_delivery: "Оплата при отриманні — ще не оплачено",
  created: "Очікує онлайн-оплати",
  success: "Оплату підтверджено банком",
  failure: "Оплата не вдалася",
  reversed: "Платіж повернено",
  expired: "Час оплати минув",
  creation_unconfirmed: "Створення рахунку потребує перевірки",
};
const line = (value) => String(value ?? "").replace(/[\r\n\t]/g, " ");
const money = (value) => (value / 100).toFixed(2) + " грн";
export function orderMessage(order) {
  const d = JSON.parse(order.details);
  const fee = Math.round(order.amount * 0.02) + 2000;
  return [
    `Замовлення MC-${order.id.slice(0, 12).toUpperCase()}`,
    `Статус: ${labels[order.status] || order.status}`,
    `Магнітні Шахи · ${d.quantity} шт.`,
    `Сума товарів: ${money(order.amount)}`,
    ...(d.paymentMethod === "cod"
      ? [
          `Комісія переказу (2% + 20.00 ₴): ${money(fee)}`,
          `Разом без доставки: ${money(order.amount + fee)}`,
        ]
      : []),
    "Доставка оплачується окремо.",
    `Отримувач: ${line(d.first)} ${line(d.last)}`,
    `Телефон: ${line(d.phone)}`,
    `Місто: ${line(d.city.name)}`,
    `Відділення: ${line(d.warehouse.name)}`,
    `Зателефонувати: ${d.contactRequested ? "так" : "ні"}`,
    `ID: ${order.id}`,
  ].join("\n");
}
export const shouldNotify = (status) =>
  status === "awaiting_payment_on_delivery" || status === "success";
