import { deflateSync, inflateSync } from "fflate";
import { type CutterParams, defaultParams } from "./geometry/cutter";
import type { Point, Ring } from "./geometry/outline";

/**
 * Der komplette Zustand steckt im URL-Hash, damit Links geteilt werden können.
 * Der Hash geht nie an den Server – es wird nichts gespeichert.
 *
 * Format: `#n=<Name>&size=90&…&s=<Form>`; Maße nur, wenn sie vom Standard
 * abweichen.
 */
export type SharedState = {
  name: string;
  params: CutterParams;
  rings: Ring[];
};

/** Raster, auf das die normierten Koordinaten (0…1) gerundet werden. */
const GRID = 1024;
/** Douglas-Peucker-Toleranz in Rasterpunkten (≈ 0,1 mm bei 80 mm Größe). */
const TOLERANCE = 1;
/** Formatversion, damit alte Links später noch lesbar bleiben. */
const VERSION = 1;

/**
 * Douglas-Peucker für geschlossene Ringe: Anfang und Ende sind derselbe Punkt,
 * deshalb wird am entferntesten Punkt in zwei offene Hälften geteilt.
 */
const simplifyRing = (input: Point[], tolerance: number): Point[] => {
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

  const points = [...ring, ring[0]];
  const end = points.length - 1;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[split] = 1;
  const stack: [number, number][] = [
    [0, split],
    [split, end],
  ];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const distance =
        Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
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
  return ring.filter((_, i) => keep[i]);
};

const writeVarint = (out: number[], value: number) => {
  // ZigZag, damit kleine negative Deltas auch kurz bleiben.
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

export const encodeRings = (rings: Ring[]) => {
  const out: number[] = [];
  const quantized = rings
    .map((ring) =>
      simplifyRing(
        ring.map(([x, y]): Point => [x * GRID, y * GRID]),
        TOLERANCE
      ).map(([x, y]): Point => [Math.round(x), Math.round(y)])
    )
    .filter((ring) => ring.length >= 3);
  writeVarint(out, VERSION);
  writeVarint(out, quantized.length);
  for (const ring of quantized) {
    writeVarint(out, ring.length);
    let [px, py] = [0, 0];
    for (const [x, y] of ring) {
      writeVarint(out, x - px);
      writeVarint(out, y - py);
      [px, py] = [x, y];
    }
  }
  return toBase64Url(deflateSync(new Uint8Array(out), { level: 9 }));
};

export const decodeRings = (text: string): Ring[] => {
  const bytes = inflateSync(fromBase64Url(text));
  const cursor = { at: 0 };
  if (readVarint(bytes, cursor) !== VERSION)
    throw new Error("Unbekanntes Format");
  const count = readVarint(bytes, cursor);
  const rings: Ring[] = [];
  for (let r = 0; r < count; r++) {
    const length = readVarint(bytes, cursor);
    const ring: Ring = [];
    let [x, y] = [0, 0];
    for (let i = 0; i < length; i++) {
      x += readVarint(bytes, cursor);
      y += readVarint(bytes, cursor);
      ring.push([x / GRID, y / GRID]);
    }
    rings.push(ring);
  }
  return rings;
};

const paramKeys = Object.keys(defaultParams) as (keyof CutterParams)[];

export const writeHash = ({ name, params, rings }: SharedState) => {
  const query = new URLSearchParams();
  if (name) query.set("n", name);
  for (const key of paramKeys) {
    if (params[key] !== defaultParams[key]) query.set(key, String(params[key]));
  }
  if (rings.length > 0) query.set("s", encodeRings(rings));
  return query.size > 0 ? `#${query}` : "";
};

export const readHash = (hash: string): SharedState => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const params = { ...defaultParams };
  for (const key of paramKeys) {
    const value = Number(query.get(key));
    if (query.has(key) && Number.isFinite(value)) params[key] = value;
  }
  let rings: Ring[] = [];
  const shape = query.get("s");
  if (shape) {
    try {
      rings = decodeRings(shape);
    } catch (error) {
      console.warn("Form im Link ist beschädigt", error);
    }
  }
  return { name: query.get("n") ?? "", params, rings };
};
