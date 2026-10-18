import type { Box } from "../drawing";
import type { Point } from "../geometry/outline";

/**
 * Changes of place as matrices, and the selection's frame they carry along
 * – plain geometry in drawing-area pixels, nothing of the area's edge yet
 * (gestures.ts).
 */

/**
 * A change of place: x' = a·x + c·y + e, y' = b·x + d·y + f – as
 * [a, b, c, d, e, f], like SVG's `matrix()`.
 */
export type Matrix = [number, number, number, number, number, number];

export const apply = (m: Matrix, x: number, y: number): Point => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** `n` first, then `m`. */
export const compose = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const translate = (dx: number, dy: number): Matrix => [
  1,
  0,
  0,
  1,
  dx,
  dy,
];

/** Turned by `angle` (radians, clockwise on screen) about a point. */
export const turnAbout = (angle: number, cx: number, cy: number): Matrix => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};

/**
 * The selection's frame: its middle, size and how far it is turned. A new
 * selection's hugs it, upright; moving, turning and sizing carry it along
 * (`frameAfter`) – turned, it stays turned, like Figma's.
 */
export type Frame = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
};

export const frameAround = (box: Box): Frame => ({
  cx: (box.x0 + box.x1) / 2,
  cy: (box.y0 + box.y1) / 2,
  w: box.x1 - box.x0,
  h: box.y1 - box.y0,
  angle: 0,
});

/** A point in the frame's own terms – from its middle, along its sides. */
export const intoFrame = (f: Frame, x: number, y: number): Point => {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const dx = x - f.cx;
  const dy = y - f.cy;
  return [c * dx + s * dy, -s * dx + c * dy];
};

export const outOfFrame = (f: Frame, u: number, v: number): Point => {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return [f.cx + c * u - s * v, f.cy + s * u + c * v];
};

/** The frame carried along by a change. */
export const frameAfter = (f: Frame, m: Matrix): Frame => {
  const [cx, cy] = apply(m, f.cx, f.cy);
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const ux = m[0] * c + m[2] * s;
  const uy = m[1] * c + m[3] * s;
  const vx = -m[0] * s + m[2] * c;
  const vy = -m[1] * s + m[3] * c;
  return {
    cx,
    cy,
    w: f.w * Math.hypot(ux, uy),
    h: f.h * Math.hypot(vx, vy),
    angle: Math.atan2(uy, ux),
  };
};

/** Sized along the frame's sides about a point of it (frame terms). */
export const sizeIn = (
  f: Frame,
  sx: number,
  sy: number,
  ax: number,
  ay: number
): Matrix => {
  const toFrame = compose(turnAbout(-f.angle, 0, 0), translate(-f.cx, -f.cy));
  const size = compose(
    translate(ax, ay),
    compose([sx, 0, 0, sy, 0, 0], translate(-ax, -ay))
  );
  const back = compose(translate(f.cx, f.cy), turnAbout(f.angle, 0, 0));
  return compose(back, compose(size, toFrame));
};

/** The frame's handles: its corners and the middles of its sides. */
export const HANDLES: Point[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

/** The cursor for a handle – pointing the way it sizes, the frame turned. */
export const sizeCursor = (f: Frame, [hx, hy]: Point) => {
  const turned = (Math.atan2(hy, hx) + f.angle) * (180 / Math.PI);
  const way = (((turned % 180) + 180) % 180) / 45;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][
    Math.round(way) % 4
  ];
};

export type Grip =
  | { kind: "size"; handle: Point }
  | { kind: "turn" }
  | { kind: "move" };

/**
 * What a point on the selection grabs (drawing-area pixels): a handle
 * within `reach` – a corner, or a side anywhere along it; just outside a
 * corner (up to `turn` from it) the turn; the knob above the frame (`knob`
 * up, touch); the frame's inside moves. On a frame too small for its
 * handles, inside it moves – the handles are reached from outside.
 */
export const grip = (
  f: Frame,
  x: number,
  y: number,
  { reach, turn = 0, knob = 0 }: { reach: number; turn?: number; knob?: number }
): Grip | null => {
  const [u, v] = intoFrame(f, x, y);
  const hw = f.w / 2;
  const hh = f.h / 2;
  const inside = Math.abs(u) <= hw && Math.abs(v) <= hh;
  if (knob && Math.hypot(u, v + hh + knob) <= reach) return { kind: "turn" };
  const small = Math.min(f.w, f.h) < reach * 3;
  if (!(inside && small)) {
    for (const [hx, hy] of HANDLES) {
      if (!(hx && hy)) continue;
      if (Math.hypot(u - hx * hw, v - hy * hh) <= reach) {
        return { kind: "size", handle: [hx, hy] };
      }
    }
    // A side: within reach outside it, less far in on a narrow frame.
    const inX = Math.min(reach, f.w / 4);
    const inY = Math.min(reach, f.h / 4);
    if (Math.abs(u) <= hw) {
      if (v >= -hh - reach && v <= -hh + inY)
        return { kind: "size", handle: [0, -1] };
      if (v <= hh + reach && v >= hh - inY)
        return { kind: "size", handle: [0, 1] };
    }
    if (Math.abs(v) <= hh) {
      if (u >= -hw - reach && u <= -hw + inX)
        return { kind: "size", handle: [-1, 0] };
      if (u <= hw + reach && u >= hw - inX)
        return { kind: "size", handle: [1, 0] };
    }
  }
  if (inside) return { kind: "move" };
  if (turn) {
    for (const [hx, hy] of HANDLES) {
      if (hx && hy && Math.hypot(u - hx * hw, v - hy * hh) <= turn) {
        return { kind: "turn" };
      }
    }
  }
  return null;
};
