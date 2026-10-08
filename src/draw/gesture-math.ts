import { applyTransform, type Box, DRAW_RES, type Transform } from "../drawing";
import type { Point } from "../geometry/outline";

/** Smallest size (drawing-area pixels) an object can be scaled down to. */
const MIN_SIZE = 16;
/** With shift, rotation snaps in these steps … */
const ROTATE_STEP = Math.PI / 12;
/** … otherwise only near 0°, 90°, 180°, 270°, so straight stays straight. */
const ROTATE_MAGNET = (4 * Math.PI) / 180;

/** Frame of the selection: centre, size, rotation – in drawing-area pixels. */
export type Frame = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
};

/** Frame of a box, optionally transformed like the object in it. */
export const frameOf = (box: Box, transform?: Transform): Frame => {
  const middle: Point = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
  const [cx, cy] = transform ? applyTransform(transform)(middle) : middle;
  const scale = transform?.scale ?? 1;
  return {
    cx,
    cy,
    w: (box.x1 - box.x0) * scale,
    h: (box.y1 - box.y0) * scale,
    angle: transform?.angle ?? 0,
  };
};

export const snapAngle = (angle: number, steps: boolean) => {
  if (steps) return Math.round(angle / ROTATE_STEP) * ROTATE_STEP;
  const right = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(angle - right) < ROTATE_MAGNET ? right : angle;
};

export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export const middle = (a: Point, b: Point): Point => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];
export const center = (box: Box): Point => [
  (box.x0 + box.x1) / 2,
  (box.y0 + box.y1) / 2,
];
export const angleOf = (from: Point, to: Point) =>
  Math.atan2(to[1] - from[1], to[0] - from[0]);
export const inside = (box: Box, [x, y]: Point, reach: number) =>
  x >= box.x0 - reach &&
  x <= box.x1 + reach &&
  y >= box.y0 - reach &&
  y <= box.y1 + reach;
/** Rectangle between two points, whichever way it was dragged. */
export const boxBetween = (a: Point, b: Point): Box => ({
  x0: Math.min(a[0], b[0]),
  y0: Math.min(a[1], b[1]),
  x1: Math.max(a[0], b[0]),
  y1: Math.max(a[1], b[1]),
});
export const corners = (box: Box): Point[] => [
  [box.x0, box.y0],
  [box.x1, box.y0],
  [box.x1, box.y1],
  [box.x0, box.y1],
];

/** Limit the scale so the object neither vanishes nor explodes. */
export const clampScale = (box: Box, scale: number) => {
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
  return Math.min(Math.max(scale, MIN_SIZE / size), (DRAW_RES * 1.5) / size);
};

/** A pointer's position in drawing-area pixels. */
export const toPoint = (
  { clientX, clientY }: { clientX: number; clientY: number },
  rect: DOMRect
): Point => [
  ((clientX - rect.left) / rect.width) * DRAW_RES,
  ((clientY - rect.top) / rect.height) * DRAW_RES,
];
