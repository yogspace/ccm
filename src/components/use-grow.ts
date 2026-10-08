import { type RefObject, useEffect } from "react";

/**
 * Lets a box grow and shrink smoothly when its content changes size (not
 * when the window does): from its old height to the new one, then back to
 * its natural height. Watched before paint – nothing jumps in between.
 */
export const useGrow = (
  box: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>
) => {
  useEffect(() => {
    const outer = box.current;
    const inner = content.current;
    if (!(outer && inner)) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let { offsetWidth: width, offsetHeight: height } = inner;
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      const resized = inner.offsetWidth !== width;
      const grown = next - height;
      width = inner.offsetWidth;
      height = next;
      if (resized || grown === 0 || still.matches) return;
      const to = outer.offsetHeight;
      outer.style.overflow = "clip";
      outer
        .animate([{ height: `${to - grown}px` }, { height: `${to}px` }], {
          duration: 320,
          easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
        })
        .finished.catch(() => undefined)
        .finally(() => {
          outer.style.overflow = "";
        });
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [box, content]);
};
