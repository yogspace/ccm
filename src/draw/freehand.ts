import type { Point } from "../geometry/outline";

/**
 * Calm freehand lines – what the pen (use-pen.ts) makes of a shaky hand, a
 * finger on glass above all:
 *
 * 1. **Steady** – the line follows the pointer like a brush pulled on a
 *    short string (a “lazy brush”): it moves only once the pointer is
 *    `reach` away, and then just enough to stay that close – the hand's
 *    tremor stays in the string. What it leaves behind is eased a little
 *    more (`ease`: each point that share of the way to where the brush
 *    is). Let go, it runs on to where the pointer was.
 * 2. **Kept** – done, the line keeps only the points it needs to stay
 *    within `tolerance` of itself (Ramer–Douglas–Peucker).
 *
 * Drawing-area pixels; the pen turns screen pixels into them, so a line
 * drawn zoomed in is as calm as one drawn on the whole area.
 */

/** A pen's brush on its string. */
export type Steady = {
  /** The pointer is here – the points the line gets (none within reach). */
  to: (x: number, y: number) => Point[];
  /** Let go here – the rest of the way. */
  end: (x: number, y: number) => Point[];
  /** Where the line is now – its tip. */
  tip: () => Point;
};

export const steady = (
  x: number,
  y: number,
  {
    reach,
    ease = 0.55,
    step = reach / 4,
  }: {
    /** How long the string is. */
    reach: number;
    /** How far each point goes towards the brush (1: all the way). */
    ease?: number;
    /** Points nearer than this to the last are left out. */
    step?: number;
  }
): Steady => {
  let bx = x;
  let by = y;
  let lx = x;
  let ly = y;
  let last: Point = [x, y];
  const put = (out: Point[]) => {
    lx += (bx - lx) * ease;
    ly += (by - ly) * ease;
    if (Math.hypot(lx - last[0], ly - last[1]) >= step) {
      last = [lx, ly];
      out.push(last);
    }
  };
  return {
    to: (px, py) => {
      const out: Point[] = [];
      const d = Math.hypot(px - bx, py - by);
      if (d <= reach) return out;
      // Pulled along – in a few steps where the pointer leapt far.
      const parts = Math.max(1, Math.ceil((d - reach) / (reach * 2)));
      const tx = bx + ((px - bx) * (d - reach)) / d;
      const ty = by + ((py - by) * (d - reach)) / d;
      const fx = bx;
      const fy = by;
      for (let i = 1; i <= parts; i++) {
        bx = fx + ((tx - fx) * i) / parts;
        by = fy + ((ty - fy) * i) / parts;
        put(out);
      }
      return out;
    },
    end: (px, py) => {
      const out: Point[] = [];
      // On to where it was let go: the eased tip catches up, straight there.
      bx = px;
      by = py;
      for (let i = 0; i < 3; i++) put(out);
      if (last[0] !== px || last[1] !== py) {
        last = [px, py];
        out.push(last);
      }
      return out;
    },
    tip: () => [lx, ly],
  };
};

/**
 * A line's points as kept: within `tolerance` of the line as drawn, to a
 * tenth of a pixel.
 */
export const keepLine = (
  points: readonly Point[],
  tolerance: number
): Point[] => {
  const round = ([x, y]: Point): Point => [
    Math.round(x * 10) / 10,
    Math.round(y * 10) / 10,
  ];
  if (points.length < 3) return points.map(round);
  // Ramer–Douglas–Peucker: the ends, and whichever point lies furthest off
  // the line between – again on both sides of it – while one is further
  // than `tolerance`.
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = points[k];
      const off = length
        ? Math.abs((px - ax) * dy - (py - ay) * dx) / length
        : Math.hypot(px - ax, py - ay);
      if (off > worst) {
        worst = off;
        at = k;
      }
    }
    if (at >= 0 && worst > tolerance) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  const out: Point[] = [];
  for (let k = 0; k < points.length; k++) {
    if (!keep[k]) continue;
    const p = round(points[k]);
    const before = out.at(-1);
    if (before && before[0] === p[0] && before[1] === p[1]) continue;
    out.push(p);
  }
  return out;
};
