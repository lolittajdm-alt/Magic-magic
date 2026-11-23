// The keyboard reduces the visual viewport, while Safari can also pan it.
// Do not clamp offsetTop against innerHeight: some browsers resize both viewports.
export function viewportFrame({
  height,
  layoutHeight,
  offsetTop = 0,
  focused,
  baselineHeight,
}) {
  const visibleHeight = Math.max(1, Math.round(height || layoutHeight));
  const keyboardOpen = baselineHeight - visibleHeight > 140;
  return {
    height: visibleHeight,
    top: !focused && !keyboardOpen ? 0 : Math.max(0, Math.round(offsetTop)),
    keyboardOpen,
  };
}

export function installModalViewport(win, doc) {
  const root = doc.documentElement,
    body = doc.body;
  const savedScroll = { x: win.scrollX, y: win.scrollY };
  const keys = ["position", "top", "left", "width", "overflow"];
  const oldBody = Object.fromEntries(keys.map((key) => [key, body.style[key]]));
  const oldRoot = {
    overflow: root.style.overflow,
    overscrollBehavior: root.style.overscrollBehavior,
  };
  Object.assign(body.style, {
    position: "fixed",
    top: `-${savedScroll.y}px`,
    left: `-${savedScroll.x}px`,
    width: "100%",
    overflow: "hidden",
  });
  Object.assign(root.style, { overflow: "hidden", overscrollBehavior: "none" });
  root.dataset.modalOpen = "true";
  const viewport = win.visualViewport;
  let baselineHeight = win.innerHeight,
    baselineWidth = win.innerWidth,
    frame,
    revealFrame,
    needsReveal = false,
    disposed = false;
  const activeField = () => {
    const element = doc.activeElement;
    return doc.getElementById("checkout-form")?.contains(element) &&
      element?.matches("input,textarea")
      ? element
      : null;
  };
  function fit(reveal = false) {
    needsReveal ||= reveal;
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      if (disposed) return;
      if (Math.abs(win.innerWidth - baselineWidth) > 50) {
        baselineWidth = win.innerWidth;
        baselineHeight = win.innerHeight;
      }
      baselineHeight = Math.max(
        baselineHeight,
        win.innerHeight,
        viewport?.height || 0,
      );
      const field = activeField();
      const state = viewportFrame({
        height: viewport?.height,
        layoutHeight: win.innerHeight,
        offsetTop: viewport?.offsetTop,
        focused: Boolean(field),
        baselineHeight,
      });
      root.dataset.inputActive = field ? "true" : "false";
      root.dataset.keyboardOpen = state.keyboardOpen ? "true" : "false";
      root.style.setProperty("--visible-height", `${state.height}px`);
      root.style.setProperty("--visible-top", `${state.top}px`);
      if (needsReveal) {
        needsReveal = false;
        win.cancelAnimationFrame(revealFrame);
        revealFrame = win.requestAnimationFrame(() => {
          if (disposed) return;
          const input = activeField(),
            scroller = doc.getElementById("checkout-scroll");
          if (!input || !scroller) return;
          const box = input.getBoundingClientRect(),
            area = scroller.getBoundingClientRect();
          // Keep the label and space for delivery suggestions visible above the keyboard.
          const bottomRoom =
            input.dataset?.deliverySearch === "true"
              ? Math.min(
                  180,
                  Math.max(80, Math.round((area.bottom - area.top) * 0.45)),
                )
              : 24;
          if (box.bottom > area.bottom - bottomRoom)
            scroller.scrollTop += box.bottom - area.bottom + bottomRoom;
          else if (box.top < area.top + 32)
            scroller.scrollTop -= area.top + 32 - box.top;
        });
      }
    });
  }
  const resize = () => fit(true),
    pan = () => fit(false),
    focus = () => fit(true);
  fit(true);
  viewport?.addEventListener("resize", resize);
  viewport?.addEventListener("scroll", pan);
  win.addEventListener("resize", resize);
  doc.addEventListener("focusin", focus);
  doc.addEventListener("focusout", focus);
  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    win.cancelAnimationFrame(revealFrame);
    viewport?.removeEventListener("resize", resize);
    viewport?.removeEventListener("scroll", pan);
    win.removeEventListener("resize", resize);
    doc.removeEventListener("focusin", focus);
    doc.removeEventListener("focusout", focus);
    Object.assign(body.style, oldBody);
    Object.assign(root.style, oldRoot);
    delete root.dataset.modalOpen;
    delete root.dataset.inputActive;
    delete root.dataset.keyboardOpen;
    root.style.removeProperty("--visible-height");
    root.style.removeProperty("--visible-top");
    const behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    win.scrollTo(savedScroll.x, savedScroll.y);
    root.style.scrollBehavior = behavior;
  };
}
