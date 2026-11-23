import { useLayoutEffect } from "react";
import { installModalViewport } from "./modalViewport.js";
export function useModalViewport(open) {
  useLayoutEffect(() => {
    if (open) return installModalViewport(window, document);
  }, [open]);
}
