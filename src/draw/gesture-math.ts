import { type Box, DRAW_RES } from "../drawing";
import type { Point } from "../geometry/outline";
import { toArea, type View, WHOLE } from "./view";

export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Rectangle between two points, whichever way it was dragged. */
export const boxBetween = (a: Point, b: Point): Box => ({
  x0: Math.min(a[0], b[0]),
  y0: Math.min(a[1], b[1]),
  x1: Math.max(a[0], b[0]),
  y1: Math.max(a[1], b[1]),
});

/** Where a client point lies on the stage – 0 to 1 each way. */
export const onStage = (
  { clientX, clientY }: { clientX: number; clientY: number },
  rect: DOMRect
) =>
  [
    (clientX - rect.left) / (rect.width || 1),
    (clientY - rect.top) / (rect.height || 1),
  ] as const;

/** A pointer's position in drawing-area pixels – through the view, zoomed or not. */
export const toPoint = (
  event: { clientX: number; clientY: number },
  rect: DOMRect,
  view: View = WHOLE
): Point => {
  const [x, y] = toArea(view, ...onStage(event, rect));
  return [x * DRAW_RES, y * DRAW_RES];
};

/** Drawing-area pixels per CSS pixel on the stage – zoomed in, fewer. */
export const pixelsPer = (rect: DOMRect, view: View = WHOLE) =>
  DRAW_RES / ((rect.width || 1) * view.s);
