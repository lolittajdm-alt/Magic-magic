import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Reveal once, only when approaching the viewport. Content stays visible if unsupported.
export function useSectionReveal(reduced) {
  useEffect(() => {
    if (reduced || !("IntersectionObserver" in window)) return;
    const sections = document.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.dataset.reveal = "visible";
          observer.unobserve(target);
        });
      },
      { rootMargin: "0px 0px 40px 0px", threshold: 0 },
    );
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top > window.innerHeight) {
        section.dataset.reveal = "pending";
        observer.observe(section);
      }
    });
    return () => {
      observer.disconnect();
      sections.forEach((section) => {
        section.dataset.reveal = "visible";
      });
    };
  }, [reduced]);
}
