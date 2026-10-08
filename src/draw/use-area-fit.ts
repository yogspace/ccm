import { type RefObject, useLayoutEffect } from "react";

type Refs = {
  /** The container for area and bars – its size decides where the bars go. */
  area: RefObject<HTMLDivElement | null>;
  /** The grid of head, area and bars. */
  grid: RefObject<HTMLDivElement | null>;
  /** The drawing area itself. */
  stage: RefObject<HTMLDivElement | null>;
};

/**
 * The drawing area is the largest square that fits next to or above the
 * bars. What the bars need (grid minus area) is measured, not guessed –
 * depending on room they sit beside it or wrap below (--chrome-w,
 * --chrome-h on the container). Both sizes are read fresh every time: the
 * observer does not always report grid and area together, and stale values
 * made the size jump back and forth. Computed sizes instead of
 * getBoundingClientRect, so transforms (area on drop) do not count.
 *
 * Side by side (desktop, not enlarged) the card is then only as wide as
 * area and bars need – the cutter card gets the rest (--shape-w on the
 * layout, editor-app.tsx). Whether the bars sit beside the area is decided
 * by the room the card would have at half the width, as the `beside`
 * variant would (index.css) – a fitted card would keep whichever it shows.
 * If the area shows the other arrangement, the card first gets that room
 * back, so it can switch.
 */
export const useAreaFit = (refs: Refs) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable
  useLayoutEffect(() => {
    const area = refs.area.current;
    const grid = refs.grid.current;
    const stage = refs.stage.current;
    const card = area?.parentElement;
    const layout = area?.closest("main");
    if (!area || !grid || !stage || !card || !layout) return;
    const desktop = window.matchMedia("(width >= 56rem)");
    const px = (value: string) => Number.parseFloat(value);
    /** The drawing card's width side by side – empty: half the row. */
    const cardWidth = (chromeW: number, chromeH: number) => {
      if (!desktop.matches || layout.hasAttribute("data-expanded")) return "";
      const rem = px(getComputedStyle(document.documentElement).fontSize);
      const { paddingLeft, paddingRight } = getComputedStyle(card);
      const padding = px(paddingLeft) + px(paddingRight);
      const room =
        (layout.clientWidth - px(getComputedStyle(layout).columnGap)) / 2 -
        padding;
      const height = area.clientHeight;
      const beside = room >= 30 * rem && room / height >= 0.88;
      if (beside !== chromeW > 0.5) return "";
      // As --s works it out (the area's grid, draw-canvas.tsx) – but at least
      // as wide as the bars below need to stay in one row (the 34rem query):
      // wrapped, they would take height from the area.
      const side = Math.max(
        12 * rem,
        Math.min(60 * rem, room - chromeW, height - chromeH)
      );
      const fit = Math.min(room, Math.max(side + chromeW, 34 * rem));
      return `${Math.ceil(fit + padding)}px`;
    };
    /** Sets the measured sizes; `true` if they changed. */
    const measure = () => {
      const outer = getComputedStyle(grid);
      const inner = getComputedStyle(stage);
      const chromeW = px(outer.width) - px(inner.width);
      const chromeH = px(outer.height) - px(inner.height);
      const width = `${chromeW.toFixed(2)}px`;
      const height = `${chromeH.toFixed(2)}px`;
      const fit = cardWidth(chromeW, chromeH);
      const changed =
        area.style.getPropertyValue("--chrome-w") !== width ||
        area.style.getPropertyValue("--chrome-h") !== height ||
        layout.style.getPropertyValue("--shape-w") !== fit;
      area.style.setProperty("--chrome-w", width);
      area.style.setProperty("--chrome-h", height);
      if (fit) layout.style.setProperty("--shape-w", fit);
      else layout.style.removeProperty("--shape-w");
      return changed;
    };
    // Right away, before the first paint – the observer only reports once
    // the main thread is free (at start it is busy with the 3D cookies), and
    // until then the guessed sizes would show. Bars that wrap depend on the
    // size, so measure until it settles.
    for (let i = 0; i < 4 && measure(); i++);
    const observer = new ResizeObserver(() => measure());
    observer.observe(grid);
    observer.observe(stage);
    observer.observe(area);
    observer.observe(layout);
    return () => {
      observer.disconnect();
      layout.style.removeProperty("--shape-w");
    };
  }, []);
};
