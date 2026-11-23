const actions = new WeakMap();

export function registerFieldAdvance(input, action) {
  if (!input) return () => {};
  actions.set(input, action);
  return () => actions.delete(input);
}

export function focusNextField(input) {
  const form = input?.closest?.("#checkout-form");
  if (!form) return;
  const fields = [...form.querySelectorAll("input")];
  const index = fields.indexOf(input);
  if (index < 0) return;
  const next = fields[index + 1];
  // A delivery selection is required before its dependent field can be edited.
  if (next?.disabled || next?.readOnly) {
    input.focus({ preventScroll: true });
    return;
  }
  if (next) next.focus({ preventScroll: true });
  else input.blur();
}

export function advanceCheckoutField(input = document.activeElement) {
  const advance = actions.get(input);
  if (advance) advance();
  else focusNextField(input);
}
