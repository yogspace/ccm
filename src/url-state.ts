import { deflateSync, inflateSync } from "fflate";
import { type CutterParams, defaultParams } from "./geometry/cutter";
import type { Point, Ring } from "./geometry/outline";
import { PARAM_KEYS, paramKeys, paramOf } from "./link-keys";

/**
 * The complete state lives in the URL hash, so links can be shared. The hash
 * never reaches the server – nothing is stored.
 *
 * Format: `#n=<name>&z=90&…&s=<drawing>`; dimensions by their letter
 * (link-keys.ts), only when they differ from the defaults. The drawing
 * itself is stored (strokes and imported areas, each stroke with its ink),
 * so it looks just the same after opening.
 */

/** A stroke: smoothed pen points in drawing-area pixels, and its width. */
export type Stroke = {
  width: number;
  points: Point[];
  /** Eraser: takes ink away instead of putting some down. */
  erase?: boolean;
  /** Drawn in the embossing ink: pressed into the cookie, not cut. */
  emboss?: boolean;
};

export type Drawing = {
  /** Area from an SVG import or an old link, contours normalised to 0…1. */
  base: Ring[];
  /** 0 = filled; otherwise drawn along the inside of the contour in this width. */
  baseLine: number;
  strokes: Stroke[];
};

export const emptyDrawing: Drawing = { base: [], baseLine: 0, strokes: [] };

export const isEmptyDrawing = ({ base, strokes }: Drawing) =>
  base.length === 0 && strokes.length === 0;

/** Anything in the embossing ink? */
export const hasEmboss = ({ strokes }: Drawing) =>
  strokes.some(({ emboss, erase }) => emboss && !erase);

/** Stroke width used to redraw old links (contour only). */
const LEGACY_LINE = 48;

type SharedState = {
  name: string;
  params: CutterParams;
  drawing: Drawing;
  /**
   * Only for old links (version 1): the shared cutter contour the cutter is
   * built from directly. For new links it comes from the drawing.
   */
  rings: Ring[];
};

/** Grid the coordinates are rounded to (= drawing-area pixels). */
const GRID = 1024;
/** Douglas-Peucker tolerance in grid points (≈ 0.1 mm at a size of 80 mm). */
const TOLERANCE = 1;
/** Strokes rounded to 2 px – invisible at brush sizes from 6 px. */
const STROKE_STEP = 2;
/** The thicker the stroke, the more its centre line may deviate. */
const strokeTolerance = (width: number) =>
  Math.min(4, Math.max(1.5, width * 0.1));
/**
 * Format version: 1 = contour only, 2 = drawing, 3 = compact drawing, 4 = with
 * embossing. Only drawings with embossing are written as 4 – the others stay
 * as they were, byte for byte.
 */
const VERSION = 3;
const EMBOSS_VERSION = 4;

/** Douglas-Peucker for open lines: which points stay. */
const keepPoints = (points: Point[], tolerance: number) => {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay);
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      // Distance to the segment; if it is a point, to that point.
      const distance =
        length > 0
          ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
          : Math.hypot(px - ax, py - ay);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return keep;
};

export const simplifyLine = (points: Point[], tolerance: number) => {
  if (points.length < 3) return points;
  const keep = keepPoints(points, tolerance);
  return points.filter((_, i) => keep[i]);
};

/**
 * Douglas-Peucker for closed rings: start and end are the same point, so the
 * ring is split into two open halves at the farthest point.
 */
export const simplifyRing = (input: Point[], tolerance: number): Point[] => {
  const [fx, fy] = input[0];
  const [lx, ly] = input[input.length - 1];
  const ring = fx === lx && fy === ly ? input.slice(0, -1) : input;
  if (ring.length < 4) return ring;

  let split = 0;
  let farthest = 0;
  for (let i = 1; i < ring.length; i++) {
    const distance = Math.hypot(ring[i][0] - fx, ring[i][1] - fy);
    if (distance > farthest) {
      farthest = distance;
      split = i;
    }
  }
  const first = simplifyLine(ring.slice(0, split + 1), tolerance);
  const second = simplifyLine([...ring.slice(split), ring[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
};

const writeVarint = (out: number[], value: number) => {
  // ZigZag, so small negative deltas stay short too.
  let v = value >= 0 ? value * 2 : -value * 2 - 1;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
};

const readVarint = (bytes: Uint8Array, cursor: { at: number }) => {
  let value = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = bytes[cursor.at++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return value & 1 ? -(value + 1) / 2 : value / 2;
};

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0)
  );

/** Last written point – following sequences continue from it. */
type Origin = { x: number; y: number };

const origin = (): Origin => ({ x: 0, y: 0 });

/** A point sequence as deltas – short numbers that compress well. */
const writePoints = (out: number[], points: Point[], from: Origin) => {
  writeVarint(out, points.length);
  for (const [x, y] of points) {
    writeVarint(out, x - from.x);
    writeVarint(out, y - from.y);
    from.x = x;
    from.y = y;
  }
};

const readPoints = (
  bytes: Uint8Array,
  cursor: { at: number },
  from: Origin
) => {
  const length = readVarint(bytes, cursor);
  const points: Point[] = [];
  for (let i = 0; i < length; i++) {
    from.x += readVarint(bytes, cursor);
    from.y += readVarint(bytes, cursor);
    points.push([from.x, from.y]);
  }
  return points;
};

const round = ([x, y]: Point): Point => [Math.round(x), Math.round(y)];

const encodeDrawing = ({ base, baseLine, strokes }: Drawing) => {
  const out: number[] = [];
  const rings = base
    .map((ring) =>
      simplifyRing(
        ring.map(([x, y]): Point => [x * GRID, y * GRID]),
        TOLERANCE
      ).map(round)
    )
    .filter((ring) => ring.length >= 3);
  const embossed = hasEmboss({ base, baseLine, strokes });
  writeVarint(out, embossed ? EMBOSS_VERSION : VERSION);
  writeVarint(out, Math.round(baseLine));
  writeVarint(out, rings.length);
  const ringFrom = origin();
  for (const ring of rings) writePoints(out, ring, ringFrom);
  writeVarint(out, strokes.length);
  // Every stroke starts relative to the end of the previous one.
  const strokeFrom = origin();
  for (const { width, points, erase, emboss } of strokes) {
    const simplified = simplifyLine(points, strokeTolerance(width)).map(
      ([x, y]): Point => [
        Math.round(x / STROKE_STEP),
        Math.round(y / STROKE_STEP),
      ]
    );
    // Erasers as negative widths – old links only have positive ones. With
    // embossing, a pen's width is doubled, its lowest bit the ink.
    const rounded = Math.max(1, Math.round(width));
    writeVarint(
      out,
      erase ? -rounded : embossed ? rounded * 2 + (emboss ? 1 : 0) : rounded
    );
    writePoints(out, simplified, strokeFrom);
  }
  return toBase64Url(deflateSync(new Uint8Array(out), { level: 9 }));
};

const toRing = (points: Point[]): Ring =>
  points.map(([x, y]): Point => [x / GRID, y / GRID]);

const decodeDrawing = (text: string): { drawing: Drawing; rings: Ring[] } => {
  const bytes = inflateSync(fromBase64Url(text));
  const cursor = { at: 0 };
  const version = readVarint(bytes, cursor);
  // Up to version 2 every point sequence started at 0/0.
  const chained = version >= 3;
  const ringFrom = origin();
  const nextRing = () =>
    toRing(readPoints(bytes, cursor, chained ? ringFrom : origin()));

  // Version 1: only the cutter contour – it gets redrawn along the inside.
  if (version === 1) {
    const count = readVarint(bytes, cursor);
    const rings: Ring[] = [];
    for (let r = 0; r < count; r++) rings.push(nextRing());
    return {
      drawing: { base: rings, baseLine: LEGACY_LINE, strokes: [] },
      rings,
    };
  }
  if (version !== 2 && version !== VERSION && version !== EMBOSS_VERSION) {
    throw new Error("Unbekanntes Format");
  }
  const inks = version === EMBOSS_VERSION;

  const baseLine = readVarint(bytes, cursor);
  const base: Ring[] = [];
  const ringCount = readVarint(bytes, cursor);
  for (let r = 0; r < ringCount; r++) base.push(nextRing());
  const strokes: Stroke[] = [];
  const step = chained ? STROKE_STEP : 1;
  const strokeFrom = origin();
  const strokeCount = readVarint(bytes, cursor);
  for (let i = 0; i < strokeCount; i++) {
    const value = readVarint(bytes, cursor);
    const points = readPoints(bytes, cursor, chained ? strokeFrom : origin());
    const emboss = inks && value > 0 && value % 2 === 1;
    strokes.push({
      width: value < 0 ? -value : inks ? Math.floor(value / 2) : value,
      points: points.map(([x, y]): Point => [x * step, y * step]),
      ...(value < 0 && { erase: true }),
      ...(emboss && { emboss: true }),
    });
  }
  return { drawing: { base, baseLine, strokes }, rings: [] };
};

export const writeHash = ({
  name,
  params,
  drawing,
}: Omit<SharedState, "rings">) => {
  const query = new URLSearchParams();
  if (name) query.set("n", name);
  for (const key of paramKeys) {
    if (params[key] !== defaultParams[key]) {
      query.set(PARAM_KEYS[key], String(params[key]));
    }
  }
  if (!isEmptyDrawing(drawing)) query.set("s", encodeDrawing(drawing));
  return query.size > 0 ? `#${query}` : "";
};

export const readHash = (hash: string): SharedState => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const params = { ...defaultParams };
  for (const key of paramKeys) {
    const text = paramOf(query, key);
    const value = Number(text);
    if (text !== null && Number.isFinite(value)) params[key] = value;
  }
  let shape = { drawing: emptyDrawing, rings: [] as Ring[] };
  const encoded = query.get("s");
  if (encoded) {
    try {
      shape = decodeDrawing(encoded);
    } catch (error) {
      console.warn("Form im Link ist beschädigt", error);
    }
  }
  return { name: query.get("n") ?? "", params, ...shape };
};
