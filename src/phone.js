// Ukrainian phone display: +380 (67) 123-45-67.
// Add separators only when another digit follows, so Backspace never gets stuck.
export function formatPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00380")) digits = digits.slice(5);
  else if (digits.startsWith("380")) digits = digits.slice(3);
  else if (digits === "3" || digits === "38") digits = "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  if (!digits) return "+380";
  let result = `+380 (${digits.slice(0, 2)}`;
  if (digits.length > 2) result += `) ${digits.slice(2, 5)}`;
  if (digits.length > 5) result += `-${digits.slice(5, 7)}`;
  if (digits.length > 7) result += `-${digits.slice(7, 9)}`;
  return result;
}
