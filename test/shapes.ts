import type { Ring } from "../src/geometry/outline";

/**
 * Test shapes in the drawing's normalised coordinates (0–1, y down), the way
 * the drawing area traces them: a closed stroke is two rings and its inside
 * is filled; a shape drawn inside it becomes a hole.
 */

const circle = (cx: number, cy: number, r: number, n = 96): Ring =>
  Array.from({ length: n }, (_, i) => [
    cx + r * Math.cos((i / n) * 2 * Math.PI),
    cy + r * Math.sin((i / n) * 2 * Math.PI),
  ]);

/** A drawn circle: a thin ring – its inside is filled. */
const stroke = (cx: number, cy: number, r: number, w = 0.03): Ring[] => [
  circle(cx, cy, r + w / 2),
  circle(cx, cy, r - w / 2),
];

const blob = (cx: number, cy: number, r: number): Ring[] => [circle(cx, cy, r)];

const star = (cx: number, cy: number, outer: number, inner: number): Ring =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const angle = (i / 10) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });

const rectangle = (x: number, y: number, w: number, h: number): Ring => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export const shapes: Record<string, Ring[]> = {
  donut: [...stroke(0.5, 0.5, 0.4), ...stroke(0.5, 0.5, 0.18)],
  "two circles in a circle": [
    ...stroke(0.5, 0.5, 0.45),
    ...stroke(0.35, 0.5, 0.1),
    ...stroke(0.65, 0.5, 0.1),
  ],
  face: [
    ...stroke(0.5, 0.5, 0.45),
    ...blob(0.38, 0.4, 0.05),
    ...blob(0.62, 0.4, 0.05),
    ...blob(0.5, 0.65, 0.07),
  ],
  "cookie in a hole": [
    ...stroke(0.5, 0.5, 0.45),
    ...stroke(0.5, 0.5, 0.25),
    ...blob(0.5, 0.5, 0.1),
  ],
  "two small holes close together": [
    ...stroke(0.5, 0.5, 0.45),
    ...blob(0.4, 0.62, 0.035),
    ...blob(0.6, 0.62, 0.035),
  ],
  "two small holes far apart": [
    ...stroke(0.5, 0.5, 0.45),
    ...blob(0.25, 0.5, 0.035),
    ...blob(0.75, 0.5, 0.035),
  ],
  "hole near the rim": [
    ...stroke(0.5, 0.5, 0.45),
    ...blob(0.5, 0.17, 0.05),
    ...blob(0.5, 0.55, 0.06),
  ],
  "star with a star hole": [
    star(0.5, 0.5, 0.48, 0.22),
    star(0.5, 0.5, 0.45, 0.2),
    star(0.5, 0.52, 0.2, 0.09),
  ],
  "slot along the wall": [
    rectangle(0.1, 0.1, 0.8, 0.8),
    rectangle(0.12, 0.12, 0.76, 0.76),
    rectangle(0.2, 0.19, 0.6, 0.12),
  ],
};
