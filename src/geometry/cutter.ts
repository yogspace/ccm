import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./raster";

/** Alle Maße in Millimetern. */
export type CutterParams = {
  /** Längste Seite der Ausstechform (Innenmaß). */
  size: number;
  /** Gesamthöhe inklusive Rand. */
  height: number;
  /** Wandstärke der Schneide. */
  blade: number;
  /** Breite des Griffrands nach außen. */
  flangeWidth: number;
  flangeHeight: number;
  /** Schließt Lücken und Einbuchtungen bis zu diesem Radius. */
  smoothing: number;
};

export const defaultParams: CutterParams = {
  size: 70,
  height: 15,
  blade: 1.2,
  flangeWidth: 4,
  flangeHeight: 1.6,
  smoothing: 1,
};

export type CutterMesh = {
  positions: Float32Array;
  indices: Uint32Array;
  dimensions: [number, number, number];
};

const SEGMENTS = 48;
const MIN_ISLAND_AREA = 4;

const signedArea = (ring: Ring) => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

/** Skaliert die Pixelkonturen auf die Zielgröße und zentriert sie im Ursprung. */
const toMillimeters = (rings: Ring[], size: number): Ring[] => {
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
  return rings.map((ring) => {
    const scaled = ring.map(
      ([x, y]): Point => [(x - cx) * scale, (y - cy) * scale]
    );
    return signedArea(scaled) < 0 ? scaled.reverse() : scaled;
  });
};

export const buildCutter = (
  wasm: ManifoldToplevel,
  rings: Ring[],
  params: CutterParams
): CutterMesh | null => {
  if (rings.length === 0) return null;
  const garbage: (CrossSection | Manifold)[] = [];
  const track = <T extends CrossSection | Manifold>(object: T) => {
    garbage.push(object);
    return object;
  };

  try {
    const { CrossSection, Manifold } = wasm;
    let shape = track(
      new CrossSection(toMillimeters(rings, params.size), "Positive")
    );

    if (params.smoothing > 0) {
      shape = track(
        track(shape.offset(params.smoothing, "Round", 2, SEGMENTS)).offset(
          -params.smoothing,
          "Round",
          2,
          SEGMENTS
        )
      );
    }

    const islands = shape.decompose();
    garbage.push(...islands);
    shape = track(
      CrossSection.compose(
        islands.filter((island) => island.area() >= MIN_ISLAND_AREA)
      )
    );
    shape = track(shape.simplify(0.01));
    if (shape.isEmpty()) return null;

    const ringOf = (width: number, height: number) => {
      const outer = track(shape.offset(width, "Round", 2, SEGMENTS));
      return track(track(outer.subtract(shape)).extrude(height));
    };

    const parts = [ringOf(params.blade, params.height)];
    if (params.flangeWidth > 0 && params.flangeHeight > 0) {
      parts.push(
        ringOf(
          Math.max(params.flangeWidth, params.blade),
          Math.min(params.flangeHeight, params.height)
        )
      );
    }

    const cutter = track(Manifold.union(parts));
    const mesh = cutter.getMesh();
    const box = cutter.boundingBox();
    const positions = new Float32Array(
      (mesh.vertProperties.length / mesh.numProp) * 3
    );
    for (let i = 0, j = 0; i < mesh.vertProperties.length; i += mesh.numProp) {
      positions[j++] = mesh.vertProperties[i];
      positions[j++] = mesh.vertProperties[i + 1];
      positions[j++] = mesh.vertProperties[i + 2];
    }
    return {
      positions,
      indices: mesh.triVerts.slice(),
      dimensions: [
        box.max[0] - box.min[0],
        box.max[1] - box.min[1],
        box.max[2] - box.min[2],
      ],
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
