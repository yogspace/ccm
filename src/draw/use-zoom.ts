import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { onStage } from "./gesture-math";
import {
  keptView,
  MAX_ZOOM,
  movedBy,
  type View,
  WHOLE,
  zoomedAbout,
} from "./view";

/**
 * The view of the drawing area (view.ts) – and what zooms it besides
 * fingers (use-stage-pointer.ts): on a trackpad the pinch (⌘/Ctrl with the
 * wheel – Safari's own gesture, too) zooms and two fingers move it; with a
 * mouse ⌘/Ctrl and the wheel zoom. Zoomed in, the wheel moves about.
 * `onView`: told of every view shown – at most once a frame.
 */
export const useZoom = (
  stage: RefObject<HTMLElement | null>,
  onView: (view: View) => void
) => {
  const [view, setView] = useState<View>(WHOLE);
  // The latest – ahead of the render, for the pointer's handlers.
  const latest = useRef(view);
  const frame = useRef(0);
  const pending = useRef<View | null>(null);
  const told = useRef(onView);
  told.current = onView;
  /** Shown at the next frame – many moves, one render. */
  const show = useCallback((next: View) => {
    latest.current = next;
    pending.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const shown = pending.current;
      pending.current = null;
      if (!shown) return;
      setView(shown);
      told.current(shown);
    });
  }, []);
  const set = useCallback((next: View) => show(keptView(next)), [show]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const v = latest.current;
      const rect = el.getBoundingClientRect();
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      if (event.ctrlKey || event.metaKey) {
        // A trackpad's pinch, or ⌘/Ctrl with the wheel.
        event.preventDefault();
        const [px, py] = onStage(event, rect);
        show(zoomedAbout(v, Math.exp(-event.deltaY * unit * 0.01), px, py));
        return;
      }
      // Zoomed in: the wheel and two fingers on a trackpad move about.
      if (v.s <= 1) return;
      event.preventDefault();
      show(
        movedBy(
          v,
          (-event.deltaX * unit) / (rect.width || 1),
          (-event.deltaY * unit) / (rect.height || 1)
        )
      );
    };
    // Safari on a Mac pinches with its own gesture events – no wheel.
    let gestureFrom: View | null = null;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureFrom = latest.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      // Fingers on a touch screen zoom through the pointers instead.
      if (!gestureFrom || !Number.isFinite(gesture.clientX)) return;
      const from = gestureFrom;
      const [px, py] = onStage(gesture, el.getBoundingClientRect());
      const s = Math.min(MAX_ZOOM, Math.max(1, from.s * gesture.scale));
      show(zoomedAbout(from, s / from.s, px, py));
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureFrom = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
  }, [stage, show]);

  return {
    view,
    latest,
    set,
    /** Back to the whole area – at once. */
    reset: () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      pending.current = null;
      latest.current = WHOLE;
      setView(WHOLE);
      told.current(WHOLE);
    },
    zoomBy: (factor: number) => {
      show(zoomedAbout(latest.current, factor, 0.5, 0.5));
    },
  };
};
