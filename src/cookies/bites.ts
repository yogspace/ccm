import * as THREE from "three";
import { inside } from "./dough";
import {
  type CookieShape,
  cookieOutline,
  createShapeCookie,
} from "./shape-cookie";

/** A bite: round bits (cookie units, the cookie about 2 wide) taken away. */
export type Bite = { x: number; y: number; r: number }[];

/** Is there cookie at (x, y) – inside its outline, not bitten away? */
export const cookieAt = (
  outline: THREE.Vector2[][],
  bites: Bite[],
  x: number,
  y: number
) => {
  const p = new THREE.Vector2(x, y);
  return (
    outline.filter((ring) => inside(ring, p)).length % 2 === 1 &&
    !bites
      .flat()
      .some(({ x: bx, y: by, r }) => (x - bx) ** 2 + (y - by) ** 2 < r ** 2)
  );
};

/**
 * A bite right at (x, y) – teeth marks at its sides, turned the way out
 * from the middle.
 */
export const biteAt = (x: number, y: number, r = 0.42): Bite => {
  const length = Math.hypot(x, y);
  const out =
    length > 0.1
      ? new THREE.Vector2(x / length, y / length)
      : new THREE.Vector2(0, 1);
  const side = new THREE.Vector2(-out.y, out.x);
  const tooth = (sign: number) => ({
    x: x + side.x * r * 0.62 * sign + out.x * r * 0.18,
    y: y + side.y * r * 0.62 * sign + out.y * r * 0.18,
    r: r * 0.6,
  });
  return [{ x, y, r }, tooth(1), tooth(-1)];
};

/** Is anything left of the cookie after these bites? Sampled on a grid. */
export const cookieLeft = (outline: THREE.Vector2[][], bites: Bite[]) => {
  for (let x = -1.1; x <= 1.1; x += 0.04) {
    for (let y = -1.1; y <= 1.1; y += 0.04) {
      if (cookieAt(outline, bites, x, y)) return true;
    }
  }
  return false;
};

/**
 * polygon-clipping, loaded on the first bite. Its ESM build has only a
 * default export, its types only named ones.
 */
const clipping = async () => {
  const loaded = await import("polygon-clipping");
  return (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
};

type Clipping = Awaited<ReturnType<typeof clipping>>;

const circlePolygon = ({ x, y, r }: { x: number; y: number; r: number }) => [
  Array.from({ length: 40 }, (_, i): [number, number] => {
    const a = (i / 40) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  }),
];

/**
 * What is left of rings (read even-odd, as shape-cookie.ts nests them) after
 * the bites.
 */
const leftOf = (lib: Clipping, rings: THREE.Vector2[][], circles: Bite) => {
  if (rings.length === 0) return [];
  const [first, ...rest] = rings.map((ring) => [
    ring.map((p): [number, number] => [p.x, p.y]),
  ]);
  const whole = lib.xor(first, ...rest);
  return circles.length
    ? lib.difference(whole, ...circles.map(circlePolygon))
    : whole;
};

/** Smaller bits than this (cookie units², the whole about 3) are crumbs. */
const CRUMB_AREA = 0.04;

const ringArea = (ring: [number, number][]) =>
  Math.abs(
    ring.reduce(
      (sum, [x, y], i) =>
        sum +
        x * ring[(i + 1) % ring.length][1] -
        ring[(i + 1) % ring.length][0] * y,
      0
    ) / 2
  );

/**
 * The bits a bite leaves too small to stand on their own: a round bite over
 * each – they are eaten along with it.
 */
export const leftoverCrumbs = async (
  shape: CookieShape,
  bites: Bite[]
): Promise<Bite> => {
  const lib = await clipping();
  return leftOf(lib, cookieOutline(shape), bites.flat())
    .filter(
      ([outer, ...holes]) =>
        ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0) <
        CRUMB_AREA
    )
    .map(([outer]) => {
      const x = outer.reduce((sum, p) => sum + p[0], 0) / outer.length;
      const y = outer.reduce((sum, p) => sum + p[1], 0) / outer.length;
      const r = Math.max(
        ...outer.map(([px, py]) => Math.hypot(px - x, py - y))
      );
      return { x, y, r: r + 0.03 };
    });
};

/**
 * The creation baked as a cookie, bitten: the bites cut out of dough and
 * icing (polygon-clipping, loaded only now), sprinkles in them gone.
 */
export const createBittenCookie = async (shape: CookieShape, bites: Bite[]) => {
  const lib = await clipping();
  const circles = bites.flat();
  const cut = (rings: THREE.Vector2[][]) =>
    circles.length === 0
      ? rings
      : leftOf(lib, rings, circles).flatMap((polygon) =>
          polygon.map((ring) =>
            ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))
          )
        );
  const keeps = (p: THREE.Vector2) =>
    !circles.some(({ x, y, r }) => (p.x - x) ** 2 + (p.y - y) ** 2 < r ** 2);
  return createShapeCookie(shape, { cut, keeps });
};
