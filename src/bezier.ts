import type { Point } from "./geometry/outline";
import type { Stroke } from "./url-state";

/**
 * Lines drawn with the line tool – straight from point to point, or bent:
 * Bézier curves through anchors, the way Figma and Illustrator draw them.
 * Such a stroke – an anchored line – keeps its `points` like any other (all
 * that paints, traces and shares reads them) and besides them its
 * `anchors`, so it can be edited again: six numbers each, in drawing-area
 * pixels – where the anchor is, then its handle in and its handle out (x, y
 * each); a handle on its anchor is none. `closed`: the last anchor runs on
 * to the first. An anchor dragged stays in the area; its handles may reach
 * beyond it (HANDLE_REACH) – a curve along the edge needs its handle out
 * there.
 *
 * The points are always worked out from the anchors (`flatten`) – in the
 * editor and again when a link is read – so the two never part. Plain
 * numbers, no browser: links are read on the server, too.
 */

/** Numbers per anchor: x, y, in x, in y, out x, out y. */
export const ANCHOR = 6;

/** The drawing area's side in pixels (drawing.ts `DRAW_RES`). */
const SIDE = 1024;
/** The flat line keeps to the curve within this (pixels). */
const FLAT = 0.5;
/** Halved at most this often per curve. */
const DEPTH = 10;
/** Handles mirroring each other within this (pixels) – a smooth point. */
const MIRRORED = 1.5;

type Cubic = [number, number, number, number, number, number, number, number];

/** Into the drawing area, whole pixels – as a link keeps them. */
const snapPixel = (n: number) => Math.round(Math.min(Math.max(n, 0), SIDE));

/** How far beyond the area a handle may reach – each way (pixels). */
export const HANDLE_REACH = SIDE;

/** A handle's place: whole pixels, within HANDLE_REACH of the area. */
const handlePixel = (n: number) =>
  Math.round(Math.min(Math.max(n, -HANDLE_REACH), SIDE + HANDLE_REACH));

/** Anchors in their places – each in the area, its handles within reach. */
const placePixels = (a: readonly number[]) =>
  a.map((v, i) => (i % ANCHOR < 2 ? snapPixel(v) : handlePixel(v)));

export const anchorCount = (a: readonly number[]) =>
  Math.floor(a.length / ANCHOR);

/** The curve from anchor i to anchor j: i, its handle out, j's in, j. */
export const curveOf = (a: readonly number[], i: number, j: number): Cubic => [
  a[i * ANCHOR],
  a[i * ANCHOR + 1],
  a[i * ANCHOR + 4],
  a[i * ANCHOR + 5],
  a[j * ANCHOR + 2],
  a[j * ANCHOR + 3],
  a[j * ANCHOR],
  a[j * ANCHOR + 1],
];

/** The curves of a line, in order – the closing one last. */
export const curvesOf = (a: readonly number[], closed: boolean) => {
  const n = anchorCount(a);
  const curves: Cubic[] = [];
  for (let i = 0; i + 1 < n; i++) curves.push(curveOf(a, i, i + 1));
  if (closed && n > 1) curves.push(curveOf(a, n - 1, 0));
  return curves;
};

/** A curve parted at t (de Casteljau) – both parts. */
export const splitCubic = (c: Cubic, t: number): [Cubic, Cubic] => {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const ax = lerp(x0, x1);
  const ay = lerp(y0, y1);
  const bx = lerp(x1, x2);
  const by = lerp(y1, y2);
  const cx = lerp(x2, x3);
  const cy = lerp(y2, y3);
  const dx = lerp(ax, bx);
  const dy = lerp(ay, by);
  const ex = lerp(bx, cx);
  const ey = lerp(by, cy);
  const mx = lerp(dx, ex);
  const my = lerp(dy, ey);
  return [
    [x0, y0, ax, ay, dx, dy, mx, my],
    [mx, my, ex, ey, cx, cy, x3, y3],
  ];
};

export const pointOn = (c: Cubic, t: number): Point => {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [
    w0 * c[0] + w1 * c[2] + w2 * c[4] + w3 * c[6],
    w0 * c[1] + w1 * c[3] + w2 * c[5] + w3 * c[7],
  ];
};

/** How far a point lies from the segment a–b. */
const offSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t =
    length > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
      : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** Whether a curve is as good as the straight line between its ends. */
const flat = (c: Cubic) =>
  Math.max(
    offSegment(c[2], c[3], c[0], c[1], c[6], c[7]),
    offSegment(c[4], c[5], c[0], c[1], c[6], c[7])
  ) <= FLAT;

/**
 * The line through the anchors as points – halved where it bends until each
 * piece is as good as straight (within FLAT). One anchor is a dot.
 */
export const flatten = (a: readonly number[], closed = false): Point[] => {
  const n = anchorCount(a);
  if (!n) return [];
  const points: Point[] = [[a[0], a[1]]];
  const walk = (c: Cubic, depth: number) => {
    if (depth >= DEPTH || flat(c)) {
      const [, , , , , , x, y] = c;
      const [px, py] = points[points.length - 1];
      if (x !== px || y !== py) points.push([x, y]);
      return;
    }
    const [left, right] = splitCubic(c, 0.5);
    walk(left, depth + 1);
    walk(right, depth + 1);
  };
  for (const c of curvesOf(a, closed)) walk(c, 0);
  return points;
};

/**
 * Anchors in whole pixels, a whole number of them – as a link keeps them.
 * Moved as a whole, a line may stick out of the area like any stroke; only
 * what is dragged on its own stays inside.
 */
export const cleanAnchors = (a: readonly number[]) =>
  a.slice(0, anchorCount(a) * ANCHOR).map(Math.round);

/**
 * A stroke along anchors – its points worked out from them. What the editor
 * makes and what a link makes of what it keeps: the very same.
 */
export const lineStroke = (
  { width, emboss }: Pick<Stroke, "width" | "emboss">,
  anchors: readonly number[],
  closed = false
): Stroke => {
  const a = cleanAnchors(anchors);
  return {
    width,
    points: flatten(a, closed),
    ...(emboss && { emboss: true }),
    anchors: a,
    ...(closed && { closed: true }),
  };
};

/** Whether an anchor's handles mirror each other – a smooth point. */
export const isSmooth = (a: readonly number[], i: number) => {
  const k = i * ANCHOR;
  const ix = a[k + 2] - a[k];
  const iy = a[k + 3] - a[k + 1];
  const ox = a[k + 4] - a[k];
  const oy = a[k + 5] - a[k + 1];
  if (Math.hypot(ox, oy) < 1e-6 && Math.hypot(ix, iy) < 1e-6) return false;
  return Math.abs(ox + ix) < MIRRORED && Math.abs(oy + iy) < MIRRORED;
};

/** Whether a handle sits on its anchor – then there is none. */
export const noHandle = (
  a: readonly number[],
  i: number,
  side: "in" | "out"
) => {
  const k = i * ANCHOR + (side === "in" ? 2 : 4);
  return (
    Math.abs(a[k] - a[i * ANCHOR]) < 1e-6 &&
    Math.abs(a[k + 1] - a[i * ANCHOR + 1]) < 1e-6
  );
};

/** A move that keeps a value in the drawing area. */
const within = (v: number, d: number) => Math.min(Math.max(d, -v), SIDE - v);

/**
 * An anchor moved to (x, y) – kept in the area, right up to its edge – its
 * handles along, out beyond it if they go there.
 */
export const moveAnchor = (
  a: readonly number[],
  i: number,
  x: number,
  y: number
) => {
  const k = i * ANCHOR;
  const dx = within(a[k], x - a[k]);
  const dy = within(a[k + 1], y - a[k + 1]);
  const out = a.slice();
  out[k] = snapPixel(a[k] + dx);
  out[k + 1] = snapPixel(a[k + 1] + dy);
  for (const j of [2, 4]) {
    out[k + j] = handlePixel(a[k + j] + dx);
    out[k + j + 1] = handlePixel(a[k + j + 1] + dy);
  }
  return out;
};

/**
 * A handle dragged to (x, y): a smooth point's other handle mirrors it –
 * unless `free` (Alt), which makes it a corner.
 */
export const moveHandle = (
  a: readonly number[],
  i: number,
  side: "in" | "out",
  x: number,
  y: number,
  free = false
) => {
  const k = i * ANCHOR;
  const [own, other] = side === "in" ? [k + 2, k + 4] : [k + 4, k + 2];
  const out = a.slice();
  out[own] = handlePixel(x);
  out[own + 1] = handlePixel(y);
  if (isSmooth(a, i) && !free) {
    out[other] = handlePixel(2 * a[k] - out[own]);
    out[other + 1] = handlePixel(2 * a[k + 1] - out[own + 1]);
  }
  return out;
};

/**
 * A new anchor's handles pulled out to (x, y): out there, in mirrored –
 * or, `free` (Alt), only out: a corner with a curve.
 */
export const pullHandles = (
  a: readonly number[],
  i: number,
  x: number,
  y: number,
  free = false
) => {
  const k = i * ANCHOR;
  const out = a.slice();
  out[k + 4] = handlePixel(x);
  out[k + 5] = handlePixel(y);
  if (!free) {
    out[k + 2] = handlePixel(2 * a[k] - out[k + 4]);
    out[k + 3] = handlePixel(2 * a[k + 1] - out[k + 5]);
  }
  return out;
};

/**
 * Smooth ↔ corner: a smooth point's handles go onto it; a corner gets
 * mirrored handles along the way from its neighbor before to the one after
 * (a third of the way to each, on average).
 */
export const toggleSmooth = (
  a: readonly number[],
  closed: boolean,
  i: number
) => {
  const n = anchorCount(a);
  const k = i * ANCHOR;
  const out = a.slice();
  const [x, y] = [a[k], a[k + 1]];
  if (isSmooth(a, i)) {
    out[k + 2] = x;
    out[k + 3] = y;
    out[k + 4] = x;
    out[k + 5] = y;
    return out;
  }
  const at = (j: number) =>
    j < 0 || j >= n
      ? closed
        ? [a[((j + n) % n) * ANCHOR], a[((j + n) % n) * ANCHOR + 1]]
        : [x, y]
      : [a[j * ANCHOR], a[j * ANCHOR + 1]];
  const [px, py] = at(i - 1);
  const [nx, ny] = at(i + 1);
  let dx = nx - px;
  let dy = ny - py;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) {
    dx = 1;
    dy = 0;
  } else {
    dx /= length;
    dy /= length;
  }
  const reach =
    (Math.hypot(nx - x, ny - y) + Math.hypot(px - x, py - y)) / 6 || 50;
  out[k + 4] = handlePixel(x + dx * reach);
  out[k + 5] = handlePixel(y + dy * reach);
  out[k + 2] = handlePixel(x - dx * reach);
  out[k + 3] = handlePixel(y - dy * reach);
  return out;
};

/**
 * Anchor i made smooth – its handles in one line, mirrored: the one out
 * kept (or the one in, if it has only that), the other opposite it; one
 * without handles gets them as `toggleSmooth` gives them.
 */
export const smoothen = (a: readonly number[], closed: boolean, i: number) => {
  if (isSmooth(a, i)) return a.slice();
  const k = i * ANCHOR;
  const hasOut = !noHandle(a, i, "out");
  const hasIn = !noHandle(a, i, "in");
  if (!(hasOut || hasIn)) return toggleSmooth(a, closed, i);
  const out = a.slice();
  const [from, to] = hasOut ? [k + 4, k + 2] : [k + 2, k + 4];
  out[to] = handlePixel(2 * a[k] - a[from]);
  out[to + 1] = handlePixel(2 * a[k + 1] - a[from + 1]);
  return out;
};

/** A line without anchor i. */
export const removeAnchor = (a: readonly number[], i: number) => [
  ...a.slice(0, i * ANCHOR),
  ...a.slice((i + 1) * ANCHOR),
];

/** Where on the line a point is nearest: which curve, how far along, how far off. */
export const nearestOnPath = (
  a: readonly number[],
  closed: boolean,
  x: number,
  y: number
) => {
  let best = { curve: -1, t: 0, d: Infinity };
  curvesOf(a, closed).forEach((c, curve) => {
    const STEPS = 48;
    let t0 = 0;
    let d0 = Infinity;
    for (let s = 0; s <= STEPS; s++) {
      const [px, py] = pointOn(c, s / STEPS);
      const d = Math.hypot(px - x, py - y);
      if (d < d0) {
        d0 = d;
        t0 = s / STEPS;
      }
    }
    // Closer in, halving the step round the best.
    let step = 1 / STEPS;
    for (let k = 0; k < 12; k++) {
      step /= 2;
      for (const t of [t0 - step, t0 + step]) {
        if (t < 0 || t > 1) continue;
        const [px, py] = pointOn(c, t);
        const d = Math.hypot(px - x, py - y);
        if (d < d0) {
          d0 = d;
          t0 = t;
        }
      }
    }
    if (d0 < best.d) best = { curve, t: t0, d: d0 };
  });
  return best;
};

/**
 * A new anchor on the line, where it is – the line keeps its form: the
 * curve parted there (its neighbors' handles shortened to fit). Its place
 * among the anchors comes with it – on a closed line's last curve, the end.
 */
export const insertAnchor = (
  a: readonly number[],
  curve: number,
  t: number
) => {
  const n = anchorCount(a);
  const i = curve;
  const j = (curve + 1) % n;
  const [left, right] = splitCubic(curveOf(a, i, j), t);
  const out = a.slice();
  out[i * ANCHOR + 4] = left[2];
  out[i * ANCHOR + 5] = left[3];
  out[j * ANCHOR + 2] = right[4];
  out[j * ANCHOR + 3] = right[5];
  const added = [left[6], left[7], left[4], left[5], right[2], right[3]];
  const at = i + 1;
  return {
    a: placePixels([
      ...out.slice(0, at * ANCHOR),
      ...added,
      ...out.slice(at * ANCHOR),
    ]),
    index: at,
  };
};

/** A point turned about (ax, ay) to the nearest 45° – as far off as it was along that way. */
export const snap45 = (ax: number, ay: number, x: number, y: number): Point => {
  const angle =
    Math.round(Math.atan2(y - ay, x - ax) / (Math.PI / 4)) * (Math.PI / 4);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const along = (x - ax) * dx + (y - ay) * dy;
  return [ax + dx * along, ay + dy * along];
};

export type PathGrip =
  | { kind: "anchor"; i: number }
  | { kind: "in" | "out"; i: number }
  | { kind: "line"; curve: number; t: number };

/**
 * What a point on an anchored line grabs within `reach`: the nearest anchor
 * or handle (handles only where there are some), else the line itself –
 * which reaches `wide` further, half its stroke. An anchor is a third of
 * the reach ahead – a handle wins only where the press is clearly nearer
 * it, so a short handle can be grabbed beside its anchor (a finger's reach
 * covers both).
 */
export const pathGrip = (
  a: readonly number[],
  closed: boolean,
  x: number,
  y: number,
  reach: number,
  wide = 0
): PathGrip | null => {
  let best: PathGrip | null = null;
  const lead = reach / 3;
  let score = Infinity;
  for (let i = 0; i < anchorCount(a); i++) {
    const k = i * ANCHOR;
    const d = Math.hypot(a[k] - x, a[k + 1] - y);
    if (d <= reach && d - lead < score) {
      score = d - lead;
      best = { kind: "anchor", i };
    }
    for (const side of ["in", "out"] as const) {
      if (noHandle(a, i, side)) continue;
      const h = k + (side === "in" ? 2 : 4);
      const e = Math.hypot(a[h] - x, a[h + 1] - y);
      if (e <= reach && e < score) {
        score = e;
        best = { kind: side, i };
      }
    }
  }
  if (best) return best;
  const on = nearestOnPath(a, closed, x, y);
  return on.d <= reach + wide
    ? { kind: "line", curve: on.curve, t: on.t }
    : null;
};

/** Anchors moved by a change of place – `apply` maps a point. */
export const mapAnchors = (
  a: readonly number[],
  apply: (point: Point) => Point
) => {
  const out: number[] = [];
  for (let i = 0; i + 1 < a.length; i += 2) {
    const [x, y] = apply([a[i], a[i + 1]]);
    out.push(x, y);
  }
  return cleanAnchors(out);
};
