import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import {
  type ArchStyle,
  BRIDGE_MID_HEIGHT,
  buildArch,
  FILLET,
  type Scope,
  strip,
} from "./bridges";
import { type Connection, planConnections } from "./connections";
import { type Island, isHole, nestIslands } from "./islands";
import type { Point, Ring } from "./outline";
import { signedArea } from "./rings";

/** All dimensions in millimetres. */
export type CutterParams = {
  /** Longest side of the contour. */
  size: number;
  /** Blade height above the top of the flange. */
  bladeHeight: number;
  /** Wall thickness at the bottom, at the flange. */
  wall: number;
  /** Wall thickness at the top, at the cutting edge. */
  edge: number;
  /** Zone below the cutting edge in which the wall gets thinner. */
  taper: number;
  flangeWidth: number;
  flangeHeight: number;
  /** Closes gaps up to this radius (morphological closing). */
  smoothing: number;
  /** 1 = shapes inside shapes become inner blades (holes), 0 = outside only. */
  cutouts: number;
  /** Width of the bridges that hold inner blades. */
  bridgeWidth: number;
  /**
   * 1 = mirror the cutter. It is used upside down, so the cookie comes out
   * mirrored to the cutter as printed – mirroring keeps text the right way round.
   */
  mirror: number;
};

/** Range of the size slider (mm); drawing can go smaller, never larger. */
export const SIZE_RANGE = { min: 10, max: 200 } as const;

export const defaultParams: CutterParams = {
  size: 80,
  bladeHeight: 15,
  wall: 1.2,
  edge: 0.6,
  // Keep it short: the longer the thin zone, the easier the edge breaks.
  taper: 1.6,
  flangeWidth: 5,
  flangeHeight: 2,
  smoothing: 1,
  cutouts: 1,
  bridgeWidth: 3,
  mirror: 0,
};

export type Cutter = {
  /** Belongs to the caller, who must free it with `delete()`. */
  manifold: Manifold;
  /** Final contour in the same normalised coordinates as the input. */
  outline: Ring[];
  /** What holds the inner blades (in mm, before mirroring). */
  connections: Connection[];
};

/** Layer height in which the taper is stepped – invisible in print. */
const LAYER = 0.2;
/** Steps overlap a tiny bit, otherwise they stay separate parts in the export. */
const OVERLAP = 0.01;
const SEGMENTS = 48;
/** Outside: parts below this share of the total area count as crumbs. */
const MIN_ISLAND_SHARE = 0.01;
/** Inside (holes, shapes in shapes) the real size counts, not the share (mm²). */
const MIN_INNER_AREA = 6;
/**
 * Room (mm) the bridges always leave below the cutting edge for the dough –
 * nothing of them may press into the cookie.
 */
export const BRIDGE_CLEARANCE = 9;
/**
 * Open spans up to this length (mm) are bridged flat, at flange height;
 * longer ones by an arch, which is stiffer.
 */
const FLAT_SPAN = 8;
/** Flanges closer than this (mm) are linked where they come closest. */
const LINK_GAP = 4;
/** Hairline gaps in the flange plate up to this width (mm) are closed … */
const HAIRLINE = 2;
/** … and pockets enclosed by it up to this area (mm²). */
const POCKET = 20;

/** Maps the normalised contours (y down) to mm, centred, y up. */
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
 * Builds the cutter from the drawing's contours. It prints flange down, cutting
 * edge up; the face towards the cookie stays vertical, the taper is only on the
 * other side.
 *
 * The inside of a stroke is filled. If a shape lies inside another, it becomes
 * (with `cutouts`) an inner blade that cuts a hole. Its flange, half as wide,
 * lies on the cookie side; what holds it is planned in `planConnections`:
 * flat links in the flange plate where flanges come close, arched bridges
 * across longer gaps.
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
  const scope: Scope = { wasm, track };

  try {
    const { CrossSection, Manifold } = wasm;
    const grow = (shape: CrossSection, delta: number) =>
      track(shape.offset(delta, "Round", 2, SEGMENTS));
    /** Morphological closing: fills gaps and inner corners up to `radius`. */
    const close = (shape: CrossSection, radius: number) =>
      grow(grow(shape, radius), -radius);
    const areaOf = (island: Island) =>
      track(new CrossSection([island.ring], "Positive"));
    const { toMm, fromMm } = fitToSize(rings, params.size);

    let shape = track(
      new CrossSection(
        rings.map((ring) => ring.map(toMm)),
        "EvenOdd"
      )
    );
    if (params.smoothing > 0) shape = close(shape, params.smoothing);

    // Drop the strokes' holes only after closing the gaps: an almost closed
    // stroke should become a ring, not a double cutter.
    const { flangeHeight, flangeWidth, bladeHeight, wall, edge } = params;
    const all = nestIslands(
      shape.toPolygons().filter((ring) => signedArea(ring) > 0)
    );
    const rootArea = all
      .filter((island) => island.depth === 0)
      .reduce((sum, island) => sum + island.area, 0);
    const minArea = rootArea * MIN_ISLAND_SHARE;
    const kept = new Set<Island>();
    const keep = (island: Island) => {
      if (island.area < (island.depth === 0 ? minArea : MIN_INNER_AREA)) {
        return false;
      }
      if (island.parent && !kept.has(island.parent)) return false;
      if (island.depth > 0 && !params.cutouts) return false;
      // Holes too small for a wall stay cookie.
      if (isHole(island)) {
        if (grow(areaOf(island), -(wall + 0.6)).isEmpty()) return false;
      }
      return true;
    };
    // Parents are always larger – sorted by area descending, the order is right.
    for (const island of [...all].sort((a, b) => b.area - a.area)) {
      if (keep(island)) kept.add(island);
    }
    const islands = [...kept];
    if (islands.length === 0) return null;

    // Alternating cookie and hole: exactly what “even-odd” gives.
    shape = track(
      track(
        new CrossSection(
          islands.map((island) => island.ring),
          "EvenOdd"
        )
      ).simplify(0.01)
    );
    if (shape.isEmpty()) return null;

    /** Wall of thickness `thickness` around the cookie, from `z` to `z + height`. */
    const band = (thickness: number, height: number, z = 0) => {
      const ring = track(grow(shape, thickness).subtract(shape));
      return track(track(ring.extrude(height)).translate(0, 0, z));
    };

    const top = flangeHeight + bladeHeight;
    const steps =
      edge < wall ? Math.round(Math.min(params.taper, bladeHeight) / LAYER) : 0;
    const taperTop = top - steps * LAYER;

    const parts = [band(wall, taperTop)];
    for (let i = 0; i < steps; i++) {
      const thickness = wall + ((edge - wall) * (i + 1)) / steps;
      parts.push(
        band(thickness, LAYER + OVERLAP, taperTop + i * LAYER - OVERLAP)
      );
    }

    const bridgeWidth = Math.max(1, params.bridgeWidth);
    const innerFlange = flangeWidth / 2;
    const connections = planConnections(islands, {
      innerFlange,
      join: LINK_GAP,
      flatSpan: FLAT_SPAN,
      width: bridgeWidth,
      fillet: FILLET,
    });

    // The flange plate: around the outside, and half as wide around every
    // inner blade – there only over cookie and walls (on top in use, above
    // the dough), never over an opening: what a hole cuts out must still drop
    // out. Every flange keeps its width. Plus the flat links, their corners
    // rounded off where they meet a flange or wall. Hairline gaps between
    // inner flanges and small pockets in the plate are closed – they print
    // badly and catch crumbs.
    const cookieAndWalls = grow(shape, wall);
    const outer: CrossSection[] = [];
    const inner: CrossSection[] = [];
    const links: CrossSection[] = [];
    if (flangeWidth > wall) {
      for (const island of islands) {
        const area = areaOf(island);
        if (island.depth === 0) {
          outer.push(track(grow(area, flangeWidth).subtract(area)));
        } else {
          inner.push(
            track(
              track(
                grow(area, innerFlange).subtract(grow(area, -innerFlange))
              ).intersect(cookieAndWalls)
            )
          );
        }
      }
    }
    for (const { from, to, length, kind } of connections) {
      if (kind !== "flat" || length <= 0) continue;
      const dir: Point = [
        (to[0] - from[0]) / length,
        (to[1] - from[1]) / length,
      ];
      // From inside one wall into the other.
      const link = track(
        strip(scope, from, dir, -wall, length + wall, bridgeWidth).intersect(
          cookieAndWalls
        )
      );
      if (!link.isEmpty()) links.push(link);
    }
    const pieces = [...outer, ...inner, ...links];
    if (pieces.length > 0) {
      const joined = track(CrossSection.union(pieces));
      /** What closing by `radius` adds over the cookie. */
      const gaps = (radius: number) =>
        track(
          track(close(joined, radius).subtract(joined)).intersect(
            cookieAndWalls
          )
        );
      const fillets = track(
        gaps(FILLET).intersect(grow(track(CrossSection.union(links)), FILLET))
      );
      // Only between inner pieces – narrow cookie along the outside (tips,
      // thin arms) stays open from above.
      const touching = grow(
        track(CrossSection.union([...inner, ...links])),
        0.05
      );
      const hairlines = gaps(HAIRLINE / 2)
        .decompose()
        .map(track)
        .filter((gap) => !track(gap.intersect(touching)).isEmpty());
      const filled = track(
        track(joined.add(fillets)).add(track(CrossSection.union(hairlines)))
      );
      const pockets = track(shape.subtract(filled))
        .decompose()
        .map(track)
        .filter((pocket) => pocket.area() < POCKET);
      const plate = track(filled.add(track(CrossSection.union(pockets))));
      parts.push(track(plate.extrude(flangeHeight)));
    }

    // Arched bridges, below the dough's room.
    const midHeight = Math.max(BRIDGE_MID_HEIGHT, flangeHeight + 1);
    const style: ArchStyle = {
      width: bridgeWidth,
      midHeight,
      ceiling: Math.max(midHeight + 1, top - BRIDGE_CLEARANCE),
      wall,
      walls: track(grow(shape, wall).subtract(shape)),
    };
    for (const { from, to, start, end, kind } of connections) {
      if (kind !== "arch" || !start.parent) continue;
      // Cookie in a hole is held across the opening, both walls in the gap.
      const acrossOpening = !isHole(start);
      let allowed = cookieAndWalls;
      if (acrossOpening) {
        allowed = track(areaOf(start.parent).subtract(areaOf(start)));
        if (end !== start.parent) {
          allowed = track(allowed.subtract(areaOf(end)));
        }
      }
      const arch = buildArch(scope, style, {
        from,
        to,
        faces: [
          { ring: start.ring, beyondInside: true },
          { ring: end.ring, beyondInside: end !== start.parent },
        ],
        inset: acrossOpening ? wall : 0,
        allowed,
      });
      if (arch) parts.push(arch);
    }

    // Rounding can leave zero-volume splinters as parts of their own; real
    // separate pieces (e.g. letters side by side) are far larger. The result
    // is composed fresh: it belongs to the caller, not to `garbage`.
    const solids = track(Manifold.union(parts)).decompose().map(track);
    const solid = Manifold.compose(
      solids.filter((piece) => piece.volume() > 1)
    );
    // Mirrored across the y axis: the contour on the drawing stays as it is.
    const manifold = params.mirror ? solid.mirror([1, 0, 0]) : solid;
    if (manifold !== solid) solid.delete();
    return {
      manifold,
      outline: shape.toPolygons().map((ring) => ring.map(fromMm)),
      connections,
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
