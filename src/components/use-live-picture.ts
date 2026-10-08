import { type RefObject, useEffect, useRef, useState } from "react";

/** Waits this long after the last change – sliders still moving don't render. */
const SETTLE_MS = 600;

/**
 * A picture of the cutter that keeps up with it: rendered once its place is
 * (nearly) in view, then again shortly after every change of `keys`. Until
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
    release,
  }: { enabled?: boolean; release?: (picture: T) => void } = {}
): T | null => {
  const [picture, setPicture] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const renderRef = useRef(render);
  renderRef.current = render;
  const releaseRef = useRef(release);
  releaseRef.current = release;
  /** The keys the picture shows – back on show unchanged, nothing renders. */
  const shows = useRef<readonly unknown[] | null>(null);
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
    if (shows.current?.every((key, i) => Object.is(key, keys[i]))) return;
    let current = true;
    const timer = setTimeout(
      async () => {
        const next = await renderRef.current();
        if (current) {
          shows.current = keys;
          setPicture(next);
        } else if (next !== null) releaseRef.current?.(next);
      },
      hasPicture ? SETTLE_MS : 0
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [inView, enabled, ...keys]);

  // A picture replaced or gone: let it go.
  useEffect(
    () => () => {
      if (picture !== null) releaseRef.current?.(picture);
    },
    [picture]
  );

  return picture;
};
