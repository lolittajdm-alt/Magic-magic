import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceCheckoutField,
  focusNextField,
  registerFieldAdvance,
} from "./checkoutFocus.js";

test("Done advances contacts in order, waits for delivery selection, and closes at the last field", () => {
  let focused;
  const form = { querySelectorAll: () => fields };
  const fields = Array.from({ length: 5 }, () => ({
    closest: () => form,
    focus() {
      focused = this;
    },
    blur() {
      focused = null;
    },
  }));
  focused = fields[0];
  for (let i = 1; i < 4; i++) {
    advanceCheckoutField(focused);
    assert.equal(focused, fields[i]);
  }
  fields[4].readOnly = true;
  advanceCheckoutField(focused);
  assert.equal(focused, fields[3]);
  const unregister = registerFieldAdvance(fields[3], () => {
    fields[4].readOnly = false;
    focusNextField(fields[3]);
  });
  advanceCheckoutField(focused);
  assert.equal(focused, fields[4]);
  advanceCheckoutField(focused);
  assert.equal(focused, null);
  unregister();
  assert.doesNotThrow(() => advanceCheckoutField(null));
});
