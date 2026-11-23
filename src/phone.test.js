import test from "node:test";
import assert from "node:assert/strict";
import { formatPhone } from "./phone.js";

test("normalizes pasted local and international Ukrainian numbers", () => {
  for (const value of [
    "0671234567",
    "+380671234567",
    "00380671234567",
    "+380 (67) 123-45-67",
  ]) {
    assert.equal(formatPhone(value), "+380 (67) 123-45-67");
  }
  assert.equal(formatPhone(""), "+380");
  assert.equal(formatPhone("+380671234567999"), "+380 (67) 123-45-67");
});
test("backspace can remove every subscriber digit without getting stuck on punctuation", () => {
  let value = formatPhone("0671234567");
  for (let count = 9; count > 0; count--) {
    const next = formatPhone(value.slice(0, -1));
    assert.ok(next.replace(/\D/g, "").length < value.replace(/\D/g, "").length);
    value = next;
  }
  assert.equal(value, "+380");
});
