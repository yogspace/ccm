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
import { bounds, contains, signedArea } from "./rings";
import { SIGNATURE_BAND, SIGNATURE_RAISE, signatureArea } from "./signature";

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
  /**
   * How far (mm) embossing reaches out of the flange plate – 0: flush with
   * it, the blade height: as high as the walls.
   */
  relief: number;
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
  relief: 10,
};

export type Cutter = {
  /** Belongs to the caller, who must free it with `delete()`. */
  manifold: Manifold;
  /** Final contour in the same normalised coordinates as the input. */
  outline: Ring[];
  /** The cookie's icing: the contour a little smaller, corners rounded. */
  icing: Ring[];
  /** What holds the inner blades (in mm, before mirroring). */
  connections: Connection[];
  /**
   * The embossing's originalID – its faces keep it through every boolean,
   * so the view can show them in the embossing ink (mesh.ts). Null without.
   */
  emboss: number | null;
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
/** How far (share of the size) the icing stays inside the cookie's edge … */
const ICING_INSET = 0.05;
/** … covering at least this share of the cookie, else it is left off … */
const ICING_SHARE = 0.4;
/** … and without bits of icing below this share. */
const ICING_CRUMB = 0.03;
/** The flange as wide as asked – and wide enough for the maker's mark. */
export const flangeOf = ({ flangeWidth, wall }: CutterParams) =>
  Math.max(flangeWidth, wall + SIGNATURE_BAND);

/** How far (mm) embossing reaches out of the flange – at most as the walls. */
export const reliefReach = ({ bladeHeight, relief }: CutterParams) =>
  Math.max(0, Math.min(bladeHeight, relief));
/** Embossing leaves out crumbs below this area (mm²). */
const MIN_RELIEF = 0.5;
/** Hairline gaps in the flange plate up to this width (mm) are closed … */
const HAIRLINE = 2;
/** … and pockets enclosed by it up to this area (mm²); larger ones rounded. */
const POCKET = 20;

/** Maps the normalised contours (y down) to mm, centred, y up. */
const fitToSize = (rings: Ring[], size: number) => {
  const { minX, minY, maxX, maxY } = bounds(rings.flat());
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
 *
 * `emboss`: what was drawn in the embossing ink (same coordinates). Where it
 * lies on the cookie it is made like a hole – its flange around it, held by
 * flat links (never arches) – only filled, and reaching `relief` out of the
 * flange instead of up to the cutting edge.
 */
export const buildCutter = (
  wasm: ManifoldToplevel,
  rings: Ring[],
  params: CutterParams,
  emboss: Ring[] = []
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
    const { flangeHeight, bladeHeight, wall, edge } = params;
    const flangeWidth = flangeOf(params);
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

    // Embossing only where there is cookie – not over openings, not outside.
    let relief: CrossSection | null = null;
    if (emboss.length > 0) {
      const drawn = track(
        new CrossSection(
          emboss.map((ring) => ring.map(toMm)),
          "EvenOdd"
        )
      );
      const pads = track(drawn.intersect(shape))
        .decompose()
        .map(track)
        .filter((pad) => pad.area() > MIN_RELIEF);
      if (pads.length > 0) relief = track(CrossSection.union(pads));
    }
    // To be held, each embossed area counts as a hole in the cookie it lies
    // on – for the links and arches only, the cookie keeps it.
    const reliefs: Island[] = [];
    for (const ring of relief?.toPolygons() ?? []) {
      if (signedArea(ring) <= 0) continue;
      const around = islands
        .filter((island) => contains(island.ring, ring[0]))
        .sort((a, b) => b.depth - a.depth)[0];
      // Right on a hole's edge the hole may claim it – its cookie is meant.
      const parent = around && isHole(around) ? around.parent : around;
      if (!parent) continue;
      reliefs.push({
        ring,
        area: signedArea(ring),
        parent,
        depth: parent.depth + 1,
        relief: true,
      });
    }

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
    const connections = planConnections([...islands, ...reliefs], {
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
    // inner flanges are closed, pockets enclosed by the plate rounded off or,
    // if small, closed – they print badly and catch crumbs.
    const cookieAndWalls = grow(shape, wall);
    const walls = track(cookieAndWalls.subtract(shape));
    const outer: CrossSection[] = [];
    const inner: CrossSection[] = [];
    const links: CrossSection[] = [];
    if (flangeWidth > wall) {
      for (const island of [...islands, ...reliefs]) {
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
    let plate: CrossSection | null = null;
    if (pieces.length > 0) {
      const joined = track(CrossSection.union(pieces));
      /**
       * What closing by `radius` adds over the cookie up to `reach` from
       * `around` – the plate cut out wide enough that its cut edges stay out.
       */
      const gaps = (radius: number, around: CrossSection, reach: number) => {
        const near = track(joined.intersect(grow(around, reach + radius)));
        return track(
          track(
            track(close(near, radius).subtract(near)).intersect(
              grow(around, reach)
            )
          ).intersect(cookieAndWalls)
        );
      };
      const linked = track(CrossSection.union(links));
      const fillets = links.length > 0 ? gaps(FILLET, linked, FILLET) : linked;
      // Only next to inner pieces – narrow cookie along the outside (tips,
      // thin arms) stays open from above. Offsetting curves leaves dust.
      const innerPieces = track(CrossSection.union([...inner, ...links]));
      const hairlines = gaps(HAIRLINE / 2, innerPieces, HAIRLINE)
        .decompose()
        .map(track)
        .filter(
          (gap) =>
            gap.area() > 0.01 &&
            !track(grow(gap, 0.05).intersect(innerPieces)).isEmpty()
        );
      const filled = track(
        track(joined.add(fillets)).add(track(CrossSection.union(hairlines)))
      );
      // Cookie along the outside is open to the rim, a pocket is not.
      const roots = track(
        CrossSection.union(
          islands.filter(({ depth }) => depth === 0).map(areaOf)
        )
      );
      const rim = track(grow(roots, 0.05).subtract(grow(roots, -0.05)));
      const plugs = track(shape.subtract(filled))
        .decompose()
        .map(track)
        .filter((pocket) => track(pocket.intersect(rim)).isEmpty())
        .map((pocket) =>
          pocket.area() < POCKET
            ? pocket
            : track(pocket.subtract(grow(grow(pocket, -FILLET), FILLET)))
        );
      plate = track(filled.add(track(CrossSection.union(plugs))));
      parts.push(track(plate.extrude(flangeHeight)));
    }

    let embossId: number | null = null;
    if (relief) {
      // Filled from the bed up, `relief` out of the flange.
      const pads = track(
        track(relief.extrude(flangeHeight + reliefReach(params))).asOriginal()
      );
      embossId = pads.originalID();
      parts.push(pads);
    }

    // Arched bridges, below the dough's room.
    const solidWalls = relief ? track(walls.add(relief)) : walls;
    const blend = plate ? track(solidWalls.add(plate)) : solidWalls;
    const midHeight = Math.max(BRIDGE_MID_HEIGHT, flangeHeight + 1);
    const style: ArchStyle = {
      width: bridgeWidth,
      midHeight,
      ceiling: Math.max(midHeight + 1, top - BRIDGE_CLEARANCE),
      wall,
      // Bridges blend into walls, flanges and embossing alike.
      walls: blend,
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
    const mirrored = params.mirror ? solid.mirror([1, 0, 0]) : solid;
    if (mirrored !== solid) solid.delete();

    // The maker's mark, raised on the outer flange along its middle – on
    // every piece that hangs on nothing else (shapes side by side), so none
    // goes out unsigned. Placed on the cutter as it ends up (mirrored or
    // not), so it always reads right from above.
    let manifold = mirrored;
    const roots = islands.filter(({ depth }) => depth === 0);
    // Shapes whose flanges run into each other are one piece.
    const reach = roots.map((root) => grow(areaOf(root), flangeWidth));
    const pieceOf = roots.map((_, i) => i);
    const find = (i: number): number =>
      pieceOf[i] === i ? i : find(pieceOf[i]);
    for (let i = 0; i < roots.length; i++) {
      for (let j = i + 1; j < roots.length; j++) {
        if (!track(reach[i].intersect(reach[j])).isEmpty()) {
          pieceOf[find(i)] = find(j);
        }
      }
    }
    // On each piece along its largest shape.
    const largest = new Map<number, Island>();
    for (const [i, root] of roots.entries()) {
      const best = largest.get(find(i));
      if (!best || root.area > best.area) largest.set(find(i), root);
    }
    // On the flange, clear of every wall and of the flange's edge.
    const room = track(
      grow(
        track(CrossSection.union(roots.map(areaOf))),
        flangeWidth - 0.1
      ).subtract(grow(shape, wall + 0.1))
    );
    const flip = ([x, y]: Point): Point => [-x, y];
    const marks: CrossSection[] = [];
    for (const root of largest.values()) {
      const middle = grow(areaOf(root), (wall + flangeWidth) / 2)
        .toPolygons()
        .filter((ring) => signedArea(ring) > 0)
        .sort((a, b) => signedArea(b) - signedArea(a))[0];
      if (!middle) continue;
      const mark = params.mirror
        ? signatureArea(
            scope,
            // Mirrored, the ring runs the other way – turned back.
            middle.map(flip).reverse(),
            track(room.mirror([1, 0]))
          )
        : signatureArea(scope, middle, room);
      if (mark) marks.push(mark);
    }
    if (marks.length > 0) {
      const raised = track(
        track(
          track(CrossSection.union(marks)).extrude(SIGNATURE_RAISE + OVERLAP)
        ).translate(0, 0, flangeHeight - OVERLAP)
      );
      manifold = Manifold.union(mirrored, raised);
      mirrored.delete();
    }

    // For the baked cookie: icing poured on top, a little inside the edge,
    // its corners rounded like a glaze would run. Narrow shapes get a
    // narrower rim; if even that leaves little, no icing at all – crumbs of
    // icing in the tips would look odd.
    const area = shape.area();
    const pour = (inset: number) => {
      const poured = grow(grow(shape, -1.6 * inset), 0.6 * inset);
      const kept = poured
        .decompose()
        .map(track)
        .filter((part) => part.area() > area * ICING_CRUMB);
      return track(CrossSection.union(kept));
    };
    const inset = Math.min(6, Math.max(1.5, params.size * ICING_INSET));
    let icing = pour(inset);
    if (icing.area() < area * ICING_SHARE) icing = pour(inset / 2);
    const iced = icing.area() >= area * ICING_SHARE;
    return {
      manifold,
      outline: shape.toPolygons().map((ring) => ring.map(fromMm)),
      icing: iced ? icing.toPolygons().map((ring) => ring.map(fromMm)) : [],
      connections,
      emboss: embossId,
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
