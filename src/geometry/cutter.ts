import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./outline";

/** Alle Maße in Millimetern. */
export type CutterParams = {
  /** Längste Seite der Kontur. */
  size: number;
  /** Klingenhöhe ab Oberkante Falz. */
  bladeHeight: number;
  /** Wandstärke unten an der Falz. */
  wall: number;
  /** Wandstärke oben an der Schneide. */
  edge: number;
  /** Bereich unter der Schneide, in dem die Wand dünner wird. */
  taper: number;
  flangeWidth: number;
  flangeHeight: number;
  /** Schließt Lücken bis zu diesem Radius (morphologisches Closing). */
  smoothing: number;
};

export const defaultParams: CutterParams = {
  size: 80,
  bladeHeight: 15,
  wall: 1.2,
  edge: 0.6,
  // Kurz halten: Je länger der dünne Bereich, desto leichter bricht die Schneide.
  taper: 1.6,
  flangeWidth: 5,
  flangeHeight: 2,
  smoothing: 1,
};

export type Cutter = {
  /** Gehört dem Aufrufer, der es mit `delete()` freigeben muss. */
  manifold: Manifold;
  /** Finale Kontur in denselben normierten Koordinaten wie die Eingabe. */
  outline: Ring[];
};

/** Schichthöhe, in der die Verjüngung abgestuft wird – im Druck unsichtbar. */
const LAYER = 0.2;
const SEGMENTS = 48;
/** Teile unter diesem Anteil der Gesamtfläche gelten als Krümel. */
const MIN_ISLAND_SHARE = 0.01;

const signedArea = (ring: Ring) => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

/** Abbildung der normierten Konturen (y nach unten) auf mm, zentriert, y nach oben. */
const fitToSize = (rings: Ring[], size: number) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const scale = size / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    toMm: ([x, y]: Point): Point => [(x - cx) * scale, (cy - y) * scale],
    fromMm: ([x, y]: Point): Point => [x / scale + cx, cy - y / scale],
  };
};

/**
 * Baut aus den Konturen der Zeichnung den Ausstecher. Gedruckt wird Falz unten,
 * Schneide oben; die Innenkante bleibt senkrecht, verjüngt wird nur außen.
 */
export const buildCutter = (
  wasm: ManifoldToplevel,
  rings: Ring[],
  params: CutterParams
): Cutter | null => {
  if (rings.length === 0) return null;
  const garbage: (CrossSection | Manifold)[] = [];
  const track = <T extends CrossSection | Manifold>(object: T) => {
    garbage.push(object);
    return object;
  };

  try {
    const { CrossSection, Manifold } = wasm;
    const grow = (shape: CrossSection, delta: number) =>
      track(shape.offset(delta, "Round", 2, SEGMENTS));
    const { toMm, fromMm } = fitToSize(rings, params.size);

    let shape = track(
      new CrossSection(
        rings.map((ring) => ring.map(toMm)),
        "EvenOdd"
      )
    );
    if (params.smoothing > 0) {
      shape = grow(grow(shape, params.smoothing), -params.smoothing);
    }

    // Erst nach dem Schließen der Lücken die Löcher verwerfen: Ein fast
    // geschlossener Strich soll ein Ring werden, kein doppelter Ausstecher.
    const exteriors = shape.toPolygons().filter((ring) => signedArea(ring) > 0);
    shape = track(new CrossSection(exteriors, "Positive"));

    const islands = shape.decompose();
    garbage.push(...islands);
    const minArea = shape.area() * MIN_ISLAND_SHARE;
    shape = track(
      CrossSection.compose(islands.filter((part) => part.area() >= minArea))
    );
    shape = track(shape.simplify(0.01));
    if (shape.isEmpty()) return null;

    /** Wand der Dicke `thickness` außen um die Kontur, von `z` bis `z + height`. */
    const band = (thickness: number, height: number, z = 0) => {
      const ring = track(grow(shape, thickness).subtract(shape));
      return track(track(ring.extrude(height)).translate(0, 0, z));
    };

    const { flangeHeight, bladeHeight, wall, edge } = params;
    const top = flangeHeight + bladeHeight;
    const steps =
      edge < wall ? Math.round(Math.min(params.taper, bladeHeight) / LAYER) : 0;
    const taperTop = top - steps * LAYER;

    const parts = [band(wall, taperTop)];
    for (let i = 0; i < steps; i++) {
      const thickness = wall + ((edge - wall) * (i + 1)) / steps;
      parts.push(band(thickness, LAYER, taperTop + i * LAYER));
    }
    if (params.flangeWidth > wall) {
      parts.push(band(params.flangeWidth, flangeHeight));
    }

    return {
      manifold: Manifold.union(parts),
      outline: shape.toPolygons().map((ring) => ring.map(fromMm)),
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
