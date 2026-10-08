import { type RefObject, useEffect, useRef, useState } from "react";

/** Waits this long after the last change – sliders still moving don't render. */
const SETTLE_MS = 600;

/**
 * A picture of the cutter that keeps up with it: rendered once its place is
 * (nearly) in view, then again shortly after every change of `keys` – right
 * away after a change of `quick` ones only (a click, not a slider). Until
 * the first one is there it is null – the caller keeps the place with a
 * ghost. While not `enabled` (not on show) it doesn't render and keeps the
 * last one. A newer render wins over an older one that arrives late;
 * pictures replaced or left behind go to `release`.
 */
export const useLivePicture = <T>(
  place: RefObject<Element | null>,
  keys: readonly unknown[],
  render: () => Promise<T | null> | T | null,
  {
    enabled = true,
    quick = [],
    release,
  }: {
    enabled?: boolean;
    quick?: readonly unknown[];
    release?: (picture: T) => void;
  } = {}
): T | null => {
  const [picture, setPicture] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const renderRef = useRef(render);
  renderRef.current = render;
  const releaseRef = useRef(release);
  releaseRef.current = release;
  /** The keys the picture shows – back on show unchanged, nothing renders. */
  const shows = useRef<readonly unknown[] | null>(null);
  const all = [...keys, ...quick];
  const hasPicture = picture !== null;

  useEffect(() => {
    const element = place.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "300px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [place]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: renders again on every change of the caller's keys – and not when its own picture arrives
  useEffect(() => {
    if (!(inView && enabled)) return;
    const shown = shows.current;
    if (shown?.every((key, i) => Object.is(key, all[i]))) return;
    const settle = keys.some((key, i) => !(shown && Object.is(key, shown[i])));
    let current = true;
    const run = async () => {
      const next = await renderRef.current();
      if (current) {
        shows.current = all;
        setPicture(next);
      } else if (next !== null) releaseRef.current?.(next);
    };
    // Without waiting: right in this commit – before the browser starts
    // what it brings along (a colour fading), so nothing stutters in it.
    const timer = hasPicture && settle ? setTimeout(run, SETTLE_MS) : run();
    return () => {
      current = false;
      if (typeof timer === "number") clearTimeout(timer);
    };
  }, [inView, enabled, ...all]);

  // A picture replaced or gone: let it go.
  useEffect(
    () => () => {
      if (picture !== null) releaseRef.current?.(picture);
    },
    [picture]
  );

  return picture;
};
