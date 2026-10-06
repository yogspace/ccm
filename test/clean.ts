import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import { BRIDGE_CLEARANCE, type CutterParams } from "../src/geometry/cutter";
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
};

/** Narrower than this (mm) counts as a hairline slit. */
const SLIT_WIDTH = 1.8;

/**
 * Looks at a finished cutter the way a baker would, in horizontal slices:
 * the plate at the flange, the walls higher up, the room for the dough.
 */
export const inspect = (
  wasm: ManifoldToplevel,
  manifold: Manifold,
  { flangeHeight, bladeHeight, flangeWidth }: CutterParams
): Inspection => {
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

    // Nesting depth of the wall contours: 0 outside of the outer wall,
    // 1 the cookie, 2 an inner blade, 3 its opening, 4 cookie in it …
    const rings = walls.toPolygons();
    const depthOf = (ring: Ring) =>
      rings.filter((other) => other !== ring && contains(other, ring[0]))
        .length;
    const atDepth = (...depths: number[]) =>
      rings.filter((ring) => depths.includes(depthOf(ring)));
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
    const blades = section(atDepth(2));

    const open = track(cookie.subtract(plate));
    const r = SLIT_WIDTH / 2;
    const wide = track(
      track(open.offset(-r, "Round", 2, 48)).offset(r, "Round", 2, 48)
    );
    const near = track(blades.offset(flangeWidth / 2 + 1, "Round", 2, 48));
    const slits = track(open.subtract(wide))
      .decompose()
      .map(track)
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
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
