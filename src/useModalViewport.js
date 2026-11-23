import { useLayoutEffect } from "react";

// Lock the document, while leaving the dialog's own scroll area usable on iOS.
export function useModalViewport(open) {
  useLayoutEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX,
      scrollY = window.scrollY;
    const keys = ["position", "top", "left", "width", "overflow"];
    const old = Object.fromEntries(keys.map((key) => [key, body.style[key]]));
    Object.assign(body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: `-${scrollX}px`,
      width: "100%",
      overflow: "hidden",
    });
    root.dataset.modalOpen = "true";
    const viewport = window.visualViewport;
    let frame;
    function fit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height || window.innerHeight;
        // Clamp stale iOS offsets after keyboard dismissal to the layout bounds.
        const top = Math.min(
          Math.max(0, viewport?.offsetTop || 0),
          Math.max(0, window.innerHeight - height),
        );
        root.style.setProperty("--visible-height", `${height}px`);
        root.style.setProperty("--visible-top", `${top}px`);
        const field = document.activeElement;
        const scroller = document.getElementById("checkout-scroll");
        if (scroller?.contains(field) && field?.matches("input, textarea")) {
          const box = field.getBoundingClientRect(),
            area = scroller.getBoundingClientRect();
          if (box.bottom > area.bottom - 16)
            scroller.scrollTop += box.bottom - area.bottom + 16;
          else if (box.top < area.top + 16)
            scroller.scrollTop -= area.top + 16 - box.top;
        }
      });
    }
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    document.addEventListener("focusin", fit);
    document.addEventListener("focusout", fit);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      document.removeEventListener("focusin", fit);
      document.removeEventListener("focusout", fit);
      Object.assign(body.style, old);
      delete root.dataset.modalOpen;
      root.style.removeProperty("--visible-height");
      root.style.removeProperty("--visible-top");
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = behavior;
    };
  }, [open]);
}
