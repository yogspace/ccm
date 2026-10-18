import { type PointerEvent, useRef, useState } from "react";
import { applyEraser, EMBOSS_INK } from "../drawing";
import type { Point } from "../geometry/outline";
import { store } from "../store";
import type { Stroke } from "../url-state";
import { keepLine, type Steady, steady } from "./freehand";
import type { DrawingModel } from "./use-drawing";

/** The pen in the embossing ink? (The eraser has none.) */
const embossing = () => store.tool === "pen" && store.ink === "emboss";
const inkColor = () => (embossing() ? EMBOSS_INK : "#000");

/**
 * The pen's string (CSS px on screen, freehand.ts): a finger trembles more
 * than a mouse or a stylus.
 */
const STRING = { touch: 5, other: 2 };
/** A line drawn keeps to what was drawn within this (CSS px on screen). */
const KEEP = 0.45;
/**
 * No new stroke while the page scrolls, nor this long (ms) after it – on
 * phones it glides on, and the tap that stops it should not leave a dot.
 */
const SCROLL_CALM = 300;

/** When the page (or anything in it) last scrolled. */
let lastScroll = -Infinity;
// Only in the browser – the drawing area is rendered on the server too.
if (typeof window !== "undefined") {
  window.addEventListener(
    "scroll",
    () => {
      lastScroll = performance.now();
    },
    { capture: true, passive: true }
  );
}

/** Where on the area a pointer is, and how many area pixels a CSS pixel is. */
export type Locate = (event: { clientX: number; clientY: number }) => {
  at: Point;
  per: number;
};

/** A line under way: its pointer, the brush on its string, its points so far. */
type Pen = {
  pointer: number;
  brush: Steady;
  points: Point[];
  /** Area pixels per CSS pixel when it began. */
  per: number;
  erasing: boolean;
};

/** Every point the screen saw since the last move – not just the last. */
const samplesOf = (event: PointerEvent) => {
  const all = event.nativeEvent.getCoalescedEvents?.() ?? [];
  return all.length > 0 ? all : [event];
};

/**
 * Drawing and erasing on the canvas, in the brush's width and the pen's
 * ink. The pen draws calm lines (freehand.ts): it follows on a short string,
 * so a trembling finger draws a steady line; ⇧ draws straight from where it
 * began. A tap is a dot. Once lifted, the line joins the drawing as one step
 * – kept to the points it needs – or, erasing, really takes away what it
 * covered. `penDown`: while the pen is on it; `tip`: where the line is now.
 */
export const usePen = (
  { context, drawing, snapshot, repaint, commit }: DrawingModel,
  locate: Locate
) => {
  const pen = useRef<Pen | null>(null);
  // The hint disappears as soon as the pen touches down, not only afterwards.
  const [penDown, setPenDown] = useState(false);

  /** Ink along the points, from the first – as `paint` draws a line. */
  const draw = (points: readonly Point[], erasing: boolean) => {
    const ctx = context();
    const [first, ...rest] = points;
    if (!(ctx && first)) return;
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = inkColor();
    ctx.lineWidth = store.brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (rest.length === 0) {
      // A dot – filled as a circle: Safari draws no zero-length line with
      // round caps.
      ctx.arc(first[0], first[1], store.brush / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  const start = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A finger landing while the page still glides wanted to stop it, not draw.
    const scrolling = performance.now() - lastScroll < SCROLL_CALM;
    if (scrolling && event.pointerType !== "mouse") return;
    const { at, per } = locate(event);
    const erasing = store.tool === "eraser";
    const reach =
      (event.pointerType === "touch" ? STRING.touch : STRING.other) * per;
    setPenDown(true);
    pen.current = {
      pointer: event.pointerId,
      brush: steady(at[0], at[1], { reach }),
      points: [at],
      per,
      erasing,
    };
    draw([at], erasing);
  };

  const move = (event: PointerEvent) => {
    const state = pen.current;
    if (!state || state.pointer !== event.pointerId) return;
    if (event.shiftKey && !state.erasing) {
      // ⇧: straight from where it began.
      const { at } = locate(event);
      state.points = [state.points[0], at];
      repaint();
      draw(state.points, false);
      return;
    }
    const before = state.points.length;
    for (const sample of samplesOf(event)) {
      const { at } = locate(sample);
      if (state.erasing) state.points.push(at);
      else state.points.push(...state.brush.to(at[0], at[1]));
    }
    // Only what is new, from the last point it had.
    if (state.points.length > before) {
      draw(state.points.slice(Math.max(0, before - 1)), state.erasing);
    }
  };

  const end = (event: PointerEvent) => {
    const state = pen.current;
    if (!state || state.pointer !== event.pointerId) return;
    pen.current = null;
    setPenDown(false);
    if (!state.erasing && !event.shiftKey) {
      const { at } = locate(event);
      state.points.push(...state.brush.end(at[0], at[1]));
    }
    const stroke: Stroke = {
      width: store.brush,
      points: state.erasing
        ? state.points
        : keepLine(state.points, KEEP * state.per),
      ...(embossing() && { emboss: true }),
    };
    // Really remove what was erased – or keep the line as kept – and
    // repaint from the model. One step.
    snapshot();
    drawing.current = state.erasing
      ? applyEraser(drawing.current, stroke)
      : { ...drawing.current, strokes: [...drawing.current.strokes, stroke] };
    repaint();
    commit();
  };

  /** A line just begun goes – two fingers took over instead. */
  const drop = () => {
    if (!pen.current) return;
    pen.current = null;
    setPenDown(false);
    repaint();
  };

  return {
    penDown,
    start,
    move,
    end,
    drop,
    /** Whether a line or an erasing is under way. */
    busy: () => pen.current !== null,
    /** Where the line is now – null with nothing under way. */
    tip: (): Point | null => {
      const state = pen.current;
      if (!state) return null;
      return state.erasing ? (state.points.at(-1) ?? null) : state.brush.tip();
    },
  };
};
