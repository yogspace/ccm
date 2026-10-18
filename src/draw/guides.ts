import { ANCHOR, anchorCount } from "../bezier";
import {
  type Box,
  otherBoxes,
  type Selection,
  DRAW_RES as SIDE,
} from "../drawing";
import type { Drawing } from "../url-state";

/**
 * Smart guides, like Figma's: what is moved or sized snaps onto lines that
 * matter – the drawing area's middle (centred, the case that counts most)
 * and the edges and middles of every other shape – when it comes within a
 * few pixels of one; the line shows while it is there. Anchors of the line
 * tool snap level with or straight above other anchors, too.
 */

/** Lines across the area: upright ones at these x, level ones at these y. */
export type Guides = { x: number[]; y: number[] };

/** The area's own lines: its middle, each way. */
const areaLines = (): Guides => ({ x: [SIDE / 2], y: [SIDE / 2] });

/** A box's lines: its edges and its middle. */
const linesOf = (box: Box) => ({
  x: [box.x0, (box.x0 + box.x1) / 2, box.x1],
  y: [box.y0, (box.y0 + box.y1) / 2, box.y1],
});

/**
 * The lines something selected may snap to: the area's, and those of each
 * other shape (what touches is one – drawing.ts).
 */
export const guidesFor = (drawing: Drawing, picked: Selection): Guides => {
  const guides = areaLines();
  for (const box of otherBoxes(drawing, picked)) {
    const lines = linesOf(box);
    guides.x.push(...lines.x);
    guides.y.push(...lines.y);
  }
  return guides;
};

/**
 * The lines an anchor of an anchored line may snap to, set or dragged: the
 * area's middle, and level with or straight above the other anchors – of
 * every anchored line (`lines`) and of `more` (a line not yet in the
 * drawing). `but`: the anchor itself, which is no guide to itself.
 */
export const anchorGuides = (
  lines: readonly (readonly number[] | undefined)[],
  more: readonly number[] = [],
  but?: { line: number; anchor: number }
): Guides => {
  const guides = areaLines();
  const add = (a: readonly number[], skip = -1) => {
    for (let i = 0; i < anchorCount(a); i++) {
      if (i === skip) continue;
      guides.x.push(a[i * ANCHOR]);
      guides.y.push(a[i * ANCHOR + 1]);
    }
  };
  lines.forEach((a, index) => {
    if (a) add(a, but?.line === index ? but.anchor : -1);
  });
  add(more);
  return guides;
};

/** The nearest pull onto a line within `reach` – what `values` need to move. */
const pull = (values: number[], lines: number[], reach: number) => {
  let best = 0;
  let near = reach;
  for (const value of values) {
    for (const line of lines) {
      const d = line - value;
      if (Math.abs(d) <= near) {
        near = Math.abs(d);
        best = d;
      }
    }
  }
  return best;
};

/** The guide lines a box lies on – edges or middle, to a hair. */
export const linesAt = (box: Box, guides: Guides): Guides => {
  const own = linesOf(box);
  const on = (values: number[], lines: number[]) => [
    ...new Set(
      lines.filter((line) => values.some((v) => Math.abs(v - line) < 1e-3))
    ),
  ];
  return { x: on(own.x, guides.x), y: on(own.y, guides.y) };
};

/**
 * A box moved by (dx, dy), snapped onto the nearest guide within `reach`
 * on each axis it may move along (`free`).
 */
export const snapMove = (
  box: Box,
  dx: number,
  dy: number,
  guides: Guides,
  reach: number,
  free = { x: true, y: true }
): [number, number] => {
  const moved = linesOf({
    x0: box.x0 + dx,
    y0: box.y0 + dy,
    x1: box.x1 + dx,
    y1: box.y1 + dy,
  });
  return [
    dx + (free.x ? pull(moved.x, guides.x, reach) : 0),
    dy + (free.y ? pull(moved.y, guides.y, reach) : 0),
  ];
};

/**
 * A point snapped onto the nearest guide within `reach` on each axis
 * asked for – and the lines it then lies on.
 */
export const snapPoint = (
  x: number,
  y: number,
  guides: Guides,
  reach: number,
  free = { x: true, y: true }
): { x: number; y: number; lines: Guides } => {
  const sx = x + (free.x ? pull([x], guides.x, reach) : 0);
  const sy = y + (free.y ? pull([y], guides.y, reach) : 0);
  return {
    x: sx,
    y: sy,
    lines: {
      x: free.x ? guides.x.filter((line) => Math.abs(line - sx) < 1e-3) : [],
      y: free.y ? guides.y.filter((line) => Math.abs(line - sy) < 1e-3) : [],
    },
  };
};
