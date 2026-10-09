import type { CrossSection } from "manifold-3d";
import { type Scope, strip } from "./bridges";
import type { Point, Ring } from "./outline";

/**
 * The maker's mark on every cutter: “MXWR”, raised on top of the flange (up
 * as it prints, so it prints crisp) – where the flange runs calmest, along
 * its middle, letter by letter around curves, upright where it can be. Never
 * near a wall or the flange's edge; the flange is kept wide enough for it
 * (cutter.ts).
 */

/** Cap height of the letters (mm). */
export const SIGNATURE_HEIGHT = 2.45;
/** Width of their strokes (mm) – one and a half nozzles. */
const STROKE = 0.6;
/** Room they keep from the wall and the flange's edge (mm). */
const MARGIN = 0.15;
/** Free flange the mark needs beside the wall (mm). */
export const SIGNATURE_BAND = SIGNATURE_HEIGHT + STROKE + 2 * MARGIN;
/** How far it stands out of the flange (mm) – three layers. */
export const SIGNATURE_RAISE = 0.6;

/** Letters as strokes in a box one cap high, baseline at 0, y up. */
const GLYPHS: Record<string, { width: number; strokes: Point[][] }> = {
  M: {
    width: 0.9,
    strokes: [
      [
        [0, 0],
        [0, 1],
        [0.45, 0.4],
        [0.9, 1],
        [0.9, 0],
      ],
    ],
  },
  X: {
    width: 0.75,
    strokes: [
      [
        [0, 0],
        [0.75, 1],
      ],
      [
        [0, 1],
        [0.75, 0],
      ],
    ],
  },
  W: {
    width: 1,
    strokes: [
      [
        [0, 1],
        [0.25, 0],
        [0.5, 0.6],
        [0.75, 0],
        [1, 1],
      ],
    ],
  },
  R: {
    width: 0.72,
    strokes: [
      [
        [0, 0],
        [0, 1],
        [0.42, 1],
        // The bowl: a half circle down to the middle.
        ...Array.from({ length: 9 }, (_, i): Point => {
          const angle = Math.PI / 2 - (i / 8) * Math.PI;
          return [0.42 + 0.25 * Math.cos(angle), 0.75 + 0.25 * Math.sin(angle)];
        }),
        [0, 0.5],
      ],
      [
        [0.36, 0.5],
        [0.72, 0],
      ],
    ],
  },
};

/** Gap between letter boxes, in cap heights – half a millimetre stays open between strokes. */
const SPACING = 0.4;
/** Spacing (mm) of the points the flange's middle is walked in. */
const STEP = 0.25;
/** Places tried, the best first – if the best runs into a wall. */
const TRIES = 40;

/**
 * A closed ring as points exactly `STEP` apart along it – an index then
 * stands for a length (the ring's own points lie far denser and uneven).
 */
const walk = (ring: Ring): Point[] => {
  const points: Point[] = [ring[0]];
  /** How far along the ring the next point is still away. */
  let left = STEP;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const length = Math.hypot(bx - ax, by - ay);
    let at = 0;
    while (length - at >= left) {
      at += left;
      points.push([
        ax + ((bx - ax) * at) / length,
        ay + ((by - ay) * at) / length,
      ]);
      left = STEP;
    }
    left -= length - at;
  }
  // The last may land right on the first.
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  if (Math.hypot(lx - fx, ly - fy) < STEP / 2) points.pop();
  return points;
};

/** Direction of travel at a point of the walk. */
const tangentAt = (path: Point[], i: number): Point => {
  const [ax, ay] = path[(i - 2 + path.length) % path.length];
  const [bx, by] = path[(i + 2) % path.length];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  return [(bx - ax) / length, (by - ay) / length];
};

/**
 * The mark as an area, along the closed `middle` of the flange (counter-
 * clockwise, cookie on its left) – null if it fits nowhere inside `room`.
 */
export const signatureArea = (
  scope: Scope,
  middle: Ring,
  room: CrossSection
): CrossSection | null => {
  const { wasm, track } = scope;
  const H = SIGNATURE_HEIGHT;
  const letters = [..."MXWR"].map((char) => GLYPHS[char]);
  const length =
    (letters.reduce((sum, { width }) => sum + width, 0) +
      SPACING * (letters.length - 1)) *
    H;
  const path = walk(middle);
  const span = Math.ceil(length / STEP);
  if (path.length < span * 2) return null;

  // Every place along the flange: how much it turns there, and how upright
  // the letters would stand (their tops towards the cookie, on its left).
  const places = path.map((_, start) => {
    let turning = 0;
    let previous = tangentAt(path, start);
    for (let k = 1; k <= span; k++) {
      const next = tangentAt(path, (start + k) % path.length);
      turning += Math.abs(
        Math.atan2(
          previous[0] * next[1] - previous[1] * next[0],
          previous[0] * next[0] + previous[1] * next[1]
        )
      );
      previous = next;
    }
    const [tx] = tangentAt(path, (start + Math.round(span / 2)) % path.length);
    // Upright when travelling right: up (the left side) is +y.
    return { start, score: turning + 0.6 * (1 - tx) };
  });
  places.sort((a, b) => a.score - b.score);

  for (const { start } of places.slice(0, TRIES)) {
    const pieces: CrossSection[] = [];
    let along = 0;
    for (const letter of letters) {
      const center = along + (letter.width * H) / 2;
      const index = (start + Math.round(center / STEP)) % path.length;
      const [px, py] = path[index];
      const [tx, ty] = tangentAt(path, index);
      const place = ([x, y]: Point): Point => {
        const u = (x - letter.width / 2) * H;
        const v = (y - 0.5) * H;
        return [px + tx * u - ty * v, py + ty * u + tx * v];
      };
      for (const stroke of letter.strokes) {
        const points = stroke.map(place);
        for (const [i, point] of points.entries()) {
          pieces.push(
            track(
              track(wasm.CrossSection.circle(STROKE / 2, 12)).translate(point)
            )
          );
          const next = points[i + 1];
          if (!next) continue;
          const segment = Math.hypot(next[0] - point[0], next[1] - point[1]);
          if (segment === 0) continue;
          pieces.push(
            strip(
              scope,
              point,
              [(next[0] - point[0]) / segment, (next[1] - point[1]) / segment],
              0,
              segment,
              STROKE
            )
          );
        }
      }
      along += (letter.width + SPACING) * H;
    }
    const mark = track(wasm.CrossSection.union(pieces));
    // Clear of every wall and the flange's edge – else the next place.
    if (track(mark.subtract(room)).area() < 0.01) return mark;
  }
  return null;
};
