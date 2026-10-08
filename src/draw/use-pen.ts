import { type PointerEvent, useRef, useState } from "react";
import { applyEraser } from "../drawing";
import type { Point } from "../geometry/outline";
import { store } from "../store";
import type { Stroke } from "../url-state";
import { toPoint } from "./gesture-math";
import type { DrawingModel } from "./use-drawing";

type Pen = { x: number; y: number };

/** Share by which the stroke catches up with the real pen position per sample. */
const FOLLOW = 0.35;
/**
 * No new stroke while the page scrolls, nor this long (ms) after it – on
 * phones it glides on, and the tap that stops it should not leave a dot.
 */
const SCROLL_CALM = 300;

/** When the page (or anything in it) last scrolled. */
let lastScroll = -Infinity;
window.addEventListener(
  "scroll",
  () => {
    lastScroll = performance.now();
  },
  { capture: true, passive: true }
);

const toPen = (event: { clientX: number; clientY: number }, rect: DOMRect) => {
  const [x, y] = toPoint(event, rect);
  return { x, y };
};

/**
 * Drawing and erasing on the canvas: smoothed strokes in the brush's width,
 * a dot for a tap. Once lifted, the stroke joins the drawing – or, erasing,
 * really takes away what it covered. `penDown`: while the pen is on it.
 */
export const usePen = ({
  context,
  drawing,
  snapshot,
  repaint,
  commit,
}: DrawingModel) => {
  const pen = useRef<{ smoothed: Pen; mid: Pen; points: Point[] } | null>(null);
  // The hint disappears as soon as the pen touches down, not only afterwards.
  const [penDown, setPenDown] = useState(false);

  const draw = (path: (ctx: CanvasRenderingContext2D) => void) => {
    const ctx = context();
    if (!ctx) return;
    ctx.globalCompositeOperation =
      store.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = store.brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    // A finger landing while the page still glides wanted to stop it, not draw.
    const scrolling = performance.now() - lastScroll < SCROLL_CALM;
    if (scrolling && event.pointerType !== "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    snapshot();
    setPenDown(true);
    const point = toPen(event, event.currentTarget.getBoundingClientRect());
    pen.current = { smoothed: point, mid: point, points: [[point.x, point.y]] };
    // A tap without moving makes a dot. Filled as a circle, because Safari does
    // not draw zero-length lines with round caps.
    const ctx = context();
    if (!ctx) return;
    ctx.globalCompositeOperation =
      store.tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(point.x, point.y, store.brush / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = pen.current;
    if (!state) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length > 0 ? samples : [event]) {
      const raw = toPen(sample, rect);
      // Let the pen position lag behind, so jitter disappears …
      const previous = state.smoothed;
      const smoothed = {
        x: previous.x + (raw.x - previous.x) * FOLLOW,
        y: previous.y + (raw.y - previous.y) * FOLLOW,
      };
      // … and draw between the midpoints as a curve instead of a line.
      const mid = {
        x: (previous.x + smoothed.x) / 2,
        y: (previous.y + smoothed.y) / 2,
      };
      const from = state.mid;
      draw((ctx) => {
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
      });
      state.smoothed = smoothed;
      state.mid = mid;
      state.points.push([smoothed.x, smoothed.y]);
    }
  };

  const end = () => {
    const state = pen.current;
    if (!state) return;
    setPenDown(false);
    draw((ctx) => {
      ctx.moveTo(state.mid.x, state.mid.y);
      ctx.lineTo(state.smoothed.x, state.smoothed.y);
    });
    pen.current = null;
    const stroke: Stroke = { width: store.brush, points: state.points };
    if (store.tool === "eraser") {
      // Really remove what was erased and repaint from the model.
      drawing.current = applyEraser(drawing.current, stroke);
      repaint();
    } else {
      drawing.current = {
        ...drawing.current,
        strokes: [...drawing.current.strokes, stroke],
      };
    }
    commit();
  };

  return { penDown, start, move, end };
};
