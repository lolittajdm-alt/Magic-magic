export const PRICE = 1000;
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const fail = (code, message) => Object.assign(new Error(message), { code });
export function validateOrder(input) {
  const {
    quantity,
    first,
    last,
    phone,
    city,
    warehouse,
    contactRequested,
    paymentMethod = "online",
  } = input || {};
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw fail(400, "Невірна кількість наборів.");
  if (
    ![first, last].every(
      (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 80,
    )
  )
    throw fail(400, "Вкажіть ім’я та прізвище.");
  if (!["online", "cod"].includes(paymentMethod))
    throw fail(400, "Оберіть спосіб оплати.");
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (!/^380\d{9}$/.test(digits)) throw fail(400, "Перевірте номер телефону.");
  for (const place of [city, warehouse]) {
    if (
      !place ||
      !UUID.test(place.ref) ||
      typeof place.name !== "string" ||
      !place.name.trim() ||
      place.name.length > 400
    )
      throw fail(400, "Оберіть місто та відділення.");
  }
  if (warehouse.cityRef !== city.ref)
    throw fail(400, "Відділення має належати обраному місту.");
  return {
    quantity,
    paymentMethod,
    first: first.trim(),
    last: last.trim(),
    phone: "+" + digits,
    city: { ref: city.ref, name: city.name },
    warehouse: { ref: warehouse.ref, name: warehouse.name, cityRef: city.ref },
    contactRequested: contactRequested === true,
  };
}
