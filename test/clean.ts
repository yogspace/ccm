import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import {
  BRIDGE_CLEARANCE,
  type CutterParams,
  reliefReach,
} from "../src/geometry/cutter";
import type { Ring } from "../src/geometry/outline";
import { contains } from "../src/geometry/rings";

export type Inspection = {
  parts: number;
  /** Material in the dough's room below the cutting edge, besides walls (mm²). */
  inDough: number;
  /** Flange plate over openings, where cut-out dough must drop out (mm²). */
  overOpenings: number;
  /**
   * Hairline slits and sharp inner corners in the footprint next to inner
   * blades – they print badly and catch crumbs – each with its area (mm²).
   */
  slits: { area: number; at: number[] }[];
  /**
   * Spots (on a grid) where faces lie over each other – the view shows plate
   * there that no slice has.
   */
  overlaps: number;
};

/** Narrower than this (mm) counts as a hairline slit. */
const SLIT_WIDTH = 1.8;
/** Grid (mm) on which the faces are checked from above. */
const RAY_STEP = 0.5;

/**
 * Looks straight down through the mesh on a grid: every ray has to enter
 * through a bottom face and leave through a top face, in turn. Where it
 * meets two in a row, faces overlap.
 */
const overlappingFaces = (manifold: Manifold) => {
  const { numProp, vertProperties, triVerts } = manifold.getMesh();
  const at = (vert: number) => [
    vertProperties[vert * numProp],
    vertProperties[vert * numProp + 1],
    vertProperties[vert * numProp + 2],
  ];
  const faces = [];
  for (let i = 0; i < triVerts.length; i += 3) {
    const [a, b, c] = [
      at(triVerts[i]),
      at(triVerts[i + 1]),
      at(triVerts[i + 2]),
    ];
    // Twice the area seen from above; its sign: facing up or down.
    const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(up) < 1e-12) continue;
    const xs = [a[0], b[0], c[0]];
    const ys = [a[1], b[1], c[1]];
    faces.push({
      a,
      b,
      c,
      up,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    });
  }
  const { min, max } = manifold.boundingBox();
  let overlaps = 0;
  // Off the grid a little, so rays rarely run exactly along an edge.
  for (let x = min[0] + 0.0123; x < max[0]; x += RAY_STEP) {
    const column = faces.filter(({ minX, maxX }) => minX <= x && maxX >= x);
    for (let y = min[1] + 0.0371; y < max[1]; y += RAY_STEP) {
      const hits: { z: number; up: boolean }[] = [];
      for (const { a, b, c, up, minY, maxY } of column) {
        if (minY > y || maxY < y) continue;
        const wa = (b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x);
        const wb = (c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x);
        const wc = (a[0] - x) * (b[1] - y) - (a[1] - y) * (b[0] - x);
        if (wa * up < 0 || wb * up < 0 || wc * up < 0) continue;
        hits.push({ z: (wa * a[2] + wb * b[2] + wc * c[2]) / up, up: up > 0 });
      }
      hits.sort((p, q) => p.z - q.z);
      const alternating =
        hits.length % 2 === 0 &&
        hits.every(({ up }, i) => up === (i % 2 === 1));
      if (!alternating) overlaps++;
    }
  }
  return overlaps;
};

/**
 * Looks at a finished cutter the way a baker would, in horizontal slices:
 * the plate at the flange, the walls higher up, the room for the dough.
 */
export const inspect = (
  wasm: ManifoldToplevel,
  manifold: Manifold,
  params: CutterParams
): Inspection => {
  const { flangeHeight, bladeHeight, flangeWidth } = params;
  const garbage: (CrossSection | Manifold)[] = [];
  const track = <T extends CrossSection | Manifold>(object: T) => {
    garbage.push(object);
    return object;
  };
  try {
    const top = flangeHeight + bladeHeight;
    const roomTop = top - BRIDGE_CLEARANCE;
    // Just above the bed: the plate and the full footprint of the bridges.
    const plate = track(manifold.slice(0.15));
    const walls = track(manifold.slice(roomTop + 1));
    const room = track(manifold.slice(roomTop + 0.05));
    // Above the embossing only the blades reach – unless it is as high.
    const edges = track(
      manifold.slice(
        Math.max(
          roomTop + 1,
          Math.min(top - 0.1, flangeHeight + reliefReach(params) + 0.5)
        )
      )
    );

    // Nesting depth of the wall contours: 0 outside of the outer wall,
    // 1 the cookie, 2 an inner blade, 3 its opening, 4 cookie in it …
    const nesting = (slice: CrossSection) => {
      const rings = slice.toPolygons();
      const depthOf = (ring: Ring) =>
        rings.filter((other) => other !== ring && contains(other, ring[0]))
          .length;
      return (...depths: number[]) =>
        rings.filter((ring) => depths.includes(depthOf(ring)));
    };
    const atDepth = nesting(edges);
    const section = (polygons: Ring[]) =>
      track(
        polygons.length > 0
          ? new wasm.CrossSection(polygons, "EvenOdd")
          : new wasm.CrossSection([[[0, 0]]])
      );
    const cookie = section(atDepth(1, 2));
    // Openings with cookie inside are crossed by bridges on purpose.
    const inOpenings = atDepth(4);
    const openings = section(
      atDepth(3).filter(
        (ring) => !inOpenings.some((inner) => contains(ring, inner[0]))
      )
    );
    // Slits next to embossing count too.
    const blades = section(nesting(walls)(2));

    const open = track(cookie.subtract(plate));
    const r = SLIT_WIDTH / 2;
    const wide = track(
      track(open.offset(-r, "Round", 2, 48)).offset(r, "Round", 2, 48)
    );
    const near = track(blades.offset(flangeWidth / 2 + 1, "Round", 2, 48));
    const slits = track(open.subtract(wide))
      .decompose()
      .map(track)
      // Offsetting curves leaves dust along them – not a slit.
      .filter((slit) => slit.area() > 0.05)
      .filter((slit) => !track(slit.intersect(near)).isEmpty())
      .map((slit) => {
        const { min, max } = slit.bounds();
        const at = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
        return { area: slit.area(), at: at.map((v) => Math.round(v)) };
      });

    return {
      parts: manifold.decompose().map(track).length,
      inDough: Math.max(0, room.area() - walls.area()),
      overOpenings: track(plate.intersect(openings)).area(),
      slits,
      overlaps: overlappingFaces(manifold),
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
