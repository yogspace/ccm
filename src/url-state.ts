import { deflateSync, inflateSync } from "fflate";
import { type CutterParams, defaultParams } from "./geometry/cutter";
import type { Point, Ring } from "./geometry/outline";

/**
 * Der komplette Zustand steckt im URL-Hash, damit Links geteilt werden können.
 * Der Hash geht nie an den Server – es wird nichts gespeichert.
 *
 * Format: `#n=<Name>&size=90&…&s=<Zeichnung>`; Maße nur, wenn sie vom
 * Standard abweichen. Gespeichert wird die Zeichnung selbst (Striche und
 * importierte Flächen), damit sie nach dem Öffnen genauso aussieht.
 */

/** Ein Strich: geglättete Stiftpunkte in Zeichenflächen-Pixeln und Breite. */
export type Stroke = {
  width: number;
  points: Point[];
  /** Radiergummi: nimmt Tinte weg, statt welche aufzutragen. */
  erase?: boolean;
};

export type Drawing = {
  /** Fläche aus einem SVG-Import oder einem alten Link, Konturen normiert 0…1. */
  base: Ring[];
  /** 0 = gefüllt; sonst innen entlang der Kontur in dieser Breite gezeichnet. */
  baseLine: number;
  strokes: Stroke[];
};

export const emptyDrawing: Drawing = { base: [], baseLine: 0, strokes: [] };

export const isEmptyDrawing = ({ base, strokes }: Drawing) =>
  base.length === 0 && strokes.length === 0;

/** Strichbreite, mit der alte Links (nur Kontur) nachgezeichnet werden. */
const LEGACY_LINE = 48;

export type SharedState = {
  name: string;
  params: CutterParams;
  drawing: Drawing;
  /**
   * Nur bei alten Links (Version 1): die geteilte Ausstecher-Kontur, aus der
   * der Ausstecher direkt entsteht. Bei neuen Links kommt sie aus der Zeichnung.
   */
  rings: Ring[];
};

/** Raster, auf das die Koordinaten gerundet werden (= Zeichenflächen-Pixel). */
const GRID = 1024;
/** Douglas-Peucker-Toleranz in Rasterpunkten (≈ 0,1 mm bei 80 mm Größe). */
const TOLERANCE = 1;
/** Striche auf 2 px gerundet – bei Strichstärken ab 6 px unsichtbar. */
const STROKE_STEP = 2;
/** Je dicker der Strich, desto mehr darf die Mittellinie abweichen. */
const strokeTolerance = (width: number) =>
  Math.min(4, Math.max(1.5, width * 0.1));
/** Formatversion: 1 = nur Kontur, 2 = Zeichnung, 3 = Zeichnung kompakt. */
const VERSION = 3;

/** Douglas-Peucker für offene Linien: welche Punkte bleiben. */
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
      // Abstand zur Strecke; ist sie ein Punkt, zum Punkt.
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
  const first = simplifyLine(ring.slice(0, split + 1), tolerance);
  const second = simplifyLine([...ring.slice(split), ring[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
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

/** Letzter geschriebener Punkt – Folgen schließen daran an. */
type Origin = { x: number; y: number };

const origin = (): Origin => ({ x: 0, y: 0 });

/** Punktfolge als Deltas – kurze Zahlen, die sich gut komprimieren lassen. */
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

export const encodeDrawing = ({ base, baseLine, strokes }: Drawing) => {
  const out: number[] = [];
  const rings = base
    .map((ring) =>
      simplifyRing(
        ring.map(([x, y]): Point => [x * GRID, y * GRID]),
        TOLERANCE
      ).map(round)
    )
    .filter((ring) => ring.length >= 3);
  writeVarint(out, VERSION);
  writeVarint(out, Math.round(baseLine));
  writeVarint(out, rings.length);
  const ringFrom = origin();
  for (const ring of rings) writePoints(out, ring, ringFrom);
  writeVarint(out, strokes.length);
  // Jeder Strich beginnt relativ zum Ende des vorigen.
  const strokeFrom = origin();
  for (const { width, points, erase } of strokes) {
    const simplified = simplifyLine(points, strokeTolerance(width)).map(
      ([x, y]): Point => [
        Math.round(x / STROKE_STEP),
        Math.round(y / STROKE_STEP),
      ]
    );
    // Radierer als negative Breite – alte Links haben nur positive.
    writeVarint(out, Math.max(1, Math.round(width)) * (erase ? -1 : 1));
    writePoints(out, simplified, strokeFrom);
  }
  return toBase64Url(deflateSync(new Uint8Array(out), { level: 9 }));
};

const toRing = (points: Point[]): Ring =>
  points.map(([x, y]): Point => [x / GRID, y / GRID]);

export const decodeDrawing = (
  text: string
): { drawing: Drawing; rings: Ring[] } => {
  const bytes = inflateSync(fromBase64Url(text));
  const cursor = { at: 0 };
  const version = readVarint(bytes, cursor);
  // Bis Version 2 begann jede Punktfolge bei 0/0.
  const chained = version >= 3;
  const ringFrom = origin();
  const nextRing = () =>
    toRing(readPoints(bytes, cursor, chained ? ringFrom : origin()));

  // Version 1: nur die Ausstecher-Kontur – wird innen nachgezeichnet.
  if (version === 1) {
    const count = readVarint(bytes, cursor);
    const rings: Ring[] = [];
    for (let r = 0; r < count; r++) rings.push(nextRing());
    return {
      drawing: { base: rings, baseLine: LEGACY_LINE, strokes: [] },
      rings,
    };
  }
  if (version !== 2 && version !== VERSION) {
    throw new Error("Unbekanntes Format");
  }

  const baseLine = readVarint(bytes, cursor);
  const base: Ring[] = [];
  const ringCount = readVarint(bytes, cursor);
  for (let r = 0; r < ringCount; r++) base.push(nextRing());
  const strokes: Stroke[] = [];
  const step = chained ? STROKE_STEP : 1;
  const strokeFrom = origin();
  const strokeCount = readVarint(bytes, cursor);
  for (let i = 0; i < strokeCount; i++) {
    const width = readVarint(bytes, cursor);
    const points = readPoints(bytes, cursor, chained ? strokeFrom : origin());
    strokes.push({
      width: Math.abs(width),
      points: points.map(([x, y]): Point => [x * step, y * step]),
      ...(width < 0 && { erase: true }),
    });
  }
  return { drawing: { base, baseLine, strokes }, rings: [] };
};

const paramKeys = Object.keys(defaultParams) as (keyof CutterParams)[];

export const writeHash = ({
  name,
  params,
  drawing,
}: Omit<SharedState, "rings">) => {
  const query = new URLSearchParams();
  if (name) query.set("n", name);
  for (const key of paramKeys) {
    if (params[key] !== defaultParams[key]) query.set(key, String(params[key]));
  }
  if (!isEmptyDrawing(drawing)) query.set("s", encodeDrawing(drawing));
  return query.size > 0 ? `#${query}` : "";
};

export const readHash = (hash: string): SharedState => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const params = { ...defaultParams };
  for (const key of paramKeys) {
    const value = Number(query.get(key));
    if (query.has(key) && Number.isFinite(value)) params[key] = value;
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
