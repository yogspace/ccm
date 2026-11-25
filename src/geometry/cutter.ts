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
import { piecesOf } from "./pieces";
import { bounds, closestOnRing, contains, distance, signedArea } from "./rings";
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
  /**
   * The cookie's icing: the contour a little smaller, corners rounded – and
   * clear of the imprint.
   */
  icing: Ring[];
  /** Where the embossing presses into the cookie, normalised like the contour. */
  imprint: Ring[];
  /** Icing poured into the imprint, clear of its walls. */
  inlay: Ring[];
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
/** Embossing is cut apart where it is thinner than this (mm). */
const RELIEF_NECK = 0.5;
/**
 * Embossing leaves out crumbs below this area (mm²) – where a stroke runs
 * over the cookie's edge, cutting it there leaves dots too small to print.
 */
const MIN_RELIEF = 1.5;
/**
 * Embossing that touches a wall along at least this much (mm) is one piece
 * with it there – that counts as one of its supports. Less (a corner, a
 * hairline end) would break off: then it is held like any other.
 */
const WALL_CONTACT = 1;
/**
 * Embossing closer to a wall than twice this (mm) is joined to it – a gap
 * that narrow would print as a hairline or not at all.
 */
const NEAR_WALL = 0.8;
/** A bridge to a wall thinner than this (mm) would be a hairline – none. */
const MIN_BRIDGE = 0.6;
/** How far (mm) a link reaches into embossing – not through a thin stroke. */
const TUCK = 0.3;
/**
 * Where a link meets embossing it flares into it: over the embossing this
 * many times its width around (geometry/cutter.ts `flare`).
 */
const FLARE = 1.5;
/**
 * On the baked cookie, the imprint keeps this far (mm) inside the cookie's
 * edge, and the icing this far from the imprint.
 */
const IMPRINT_RIM = 0.8;
/**
 * Icing in the imprint keeps clear of its walls by this share of the size:
 * the dough's rounded rim (shape-cookie.ts) and a little room beyond it.
 */
const INLAY_INSET = 0.026;
/** Hairline gaps in the flange plate up to this width (mm) are closed … */
const HAIRLINE = 2;
/** … and pockets enclosed by it up to this area (mm²); larger ones rounded. */
const POCKET = 20;
/**
 * Offsetting leaves dust along curves and cracks between pieces – slivers
 * thinner than this (mm). In the plate they make its faces overlap (plate
 * shown over open pockets) or let it fall apart, so they are cleaned up.
 */
const DUST = 0.05;

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
 * lies on the cookie it is held like a hole – but by straight flat links
 * only, no arches, no flange: filled straight up from the bed, and reaching
 * `relief` out of the flange instead of up to the cutting edge.
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
    /** Taken apart into connected pieces (pieces.ts). */
    const apart = (section: CrossSection) => piecesOf(wasm, section);
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
      // Opened a little: where a stroke runs over the cookie's edge, cutting
      // it leaves bits on necks thinner than a nozzle – cut off, then left
      // out as crumbs.
      const pads = apart(
        grow(
          grow(track(drawn.intersect(shape)), -RELIEF_NECK / 2),
          RELIEF_NECK / 2
        )
      )
        .map(track)
        .filter((pad) => pad.area() > MIN_RELIEF);
      if (pads.length > 0) relief = track(CrossSection.union(pads));
    }
    // To be held, each embossed area counts as a hole in the cookie it lies
    // on – for the links and arches only, the cookie keeps it. Unless it
    // reaches the cookie's edge: the walls stand right outside it (`band`),
    // so there the two are one piece – a link would hold what is held.
    // Embossing that reaches the cookie's edge stands against a wall there
    // (`band`) – one piece with it. Against the wall around, that counts as
    // one of its supports: a small piece needs no link, a long one gets its
    // others away from the wall. Against a hole's wall the two hang
    // together and are held as one (connections.ts).
    const wallsAtBed = relief ? track(grow(shape, wall).subtract(shape)) : null;
    // Almost touching would print as a hairline gap: up to 2 × NEAR_WALL
    // apart, embossing and wall are joined. Of what closing the two fills,
    // only the pieces touching both – the drawing keeps its shape elsewhere.
    if (relief && wallsAtBed) {
      const solid = track(relief.add(wallsAtBed));
      const touchingWall = track(relief.intersect(grow(wallsAtBed, DUST)));
      const filled = track(close(solid, NEAR_WALL).subtract(solid));
      const touches = (piece: CrossSection, other: CrossSection) =>
        !track(grow(piece, 0.05).intersect(other)).isEmpty();
      // Where the gap is just about too wide, closing leaves a sliver – a
      // hairline again: what is thinner than MIN_BRIDGE goes (opened), and a
      // bridge left touching only one side with it. Shrunk before it is
      // taken apart: along every edge where the two nearly meet, closing
      // leaves splinters – hundreds, too many for Safari to take apart in a
      // worker (its stack runs out); none of them survives the shrinking.
      // Opening moves its edges a hair: it reaches a hair into wall and
      // embossing again, or a gap of no width would part them.
      const cores = grow(track(filled.intersect(shape)), -MIN_BRIDGE / 2);
      const bridges = (cores.isEmpty() ? [] : apart(cores))
        .map((core) => grow(track(core), MIN_BRIDGE / 2 + DUST))
        .filter(
          (piece) =>
            touches(piece, relief as CrossSection) &&
            touches(piece, wallsAtBed) &&
            // Right beside a place where they touch already, it only fills
            // the corner there – a bump, not a bridge.
            track(grow(piece, NEAR_WALL).intersect(touchingWall)).isEmpty()
        );
      if (bridges.length > 0) {
        relief = track(relief.add(track(CrossSection.union(bridges))));
      }
    }
    /**
     * Where a connected piece of embossing (with its own holes) touches a
     * wall – grown a little into it, a contact's area is its length times
     * the growth. One spot per contact, in its middle.
     */
    const contactsOf = (piece: CrossSection): Point[] => {
      if (!wallsAtBed) return [];
      const reach = 0.1;
      return apart(track(grow(piece, reach).intersect(wallsAtBed)))
        .map(track)
        .filter((touch) => touch.area() >= WALL_CONTACT * reach)
        .map((touch) => {
          const { min, max } = touch.bounds();
          return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
        });
    };
    /** The contour whose wall a contact is at – the one closest to it. */
    const wallAt = (point: Point) => {
      let best: Island | null = null;
      let bestDistance = Infinity;
      for (const island of islands) {
        const length = distance(point, closestOnRing(point, island.ring));
        if (length < bestDistance) {
          best = island;
          bestDistance = length;
        }
      }
      return best;
    };
    const reliefs: Island[] = [];
    // Piece by piece: an outline alone would take in what lies inside a
    // ring – other embossing, holes and their walls.
    for (const piece of (relief ? apart(relief) : []).map(track)) {
      const polygons = piece.toPolygons();
      const holes = polygons.filter((ring) => signedArea(ring) < 0);
      const touching = contactsOf(piece).map((point) => ({
        point,
        island: wallAt(point),
      }));
      for (const ring of polygons) {
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
          inner: holes.filter((hole) => contains(ring, hole[0])),
          contacts: touching
            .filter(({ island }) => island === parent)
            .map(({ point }) => point),
          joined: touching.flatMap(({ island }) =>
            island && island !== parent ? [island] : []
          ),
        });
      }
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
    // if small, closed – they print badly and catch crumbs. Embossing cuts
    // nothing: it is held plainly, by straight links to the strokes – no
    // flange, its pockets open but for hairlines – where a link meets it, it
    // flares into it, its corners rounded off like any link's.
    const cookieAndWalls = grow(shape, wall);
    const walls = track(cookieAndWalls.subtract(shape));
    const outer: CrossSection[] = [];
    const inner: CrossSection[] = [];
    const links: CrossSection[] = [];
    /** Links holding the embossing. */
    const plain: CrossSection[] = [];
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
    // What the embossing encloses – letters' counters, a ring's inside.
    const reliefPockets = relief
      ? track(
          track(
            new CrossSection(
              relief.toPolygons().filter((ring) => signedArea(ring) > 0),
              "Positive"
            )
          ).subtract(relief)
        )
      : null;
    // Each pocket on its own: a link lying in one (a pupil held to its
    // eye's ring) flares into what it holds there too – only the other
    // pockets stay clear of it.
    const pockets = reliefPockets ? apart(reliefPockets).map(track) : [];
    /** The pockets `of` does not reach into – null if none. */
    const pocketsBeside = (of: CrossSection) => {
      const beside = pockets.filter((pocket) =>
        track(pocket.intersect(of)).isEmpty()
      );
      return beside.length > 0 ? track(CrossSection.union(beside)) : null;
    };
    for (const { from, to, length, kind, start, end } of connections) {
      if (kind !== "flat" || length <= 0) continue;
      const dir: Point = [
        (to[0] - from[0]) / length,
        (to[1] - from[1]) / length,
      ];
      // From inside one wall into the other – into a stroke just a little.
      const into = (island: Island) => (island.relief ? TUCK : wall);
      const link = track(
        strip(
          scope,
          from,
          dir,
          -into(start),
          length + into(end),
          bridgeWidth
        ).intersect(cookieAndWalls)
      );
      if (link.isEmpty()) continue;
      if (!(relief && reliefPockets && (start.relief || end.relief))) {
        links.push(link);
        continue;
      }
      // Where it meets embossing, its square end would stick out beside a
      // tip or a stroke's round end, or leave a slit where it slants in: it
      // flares into it instead – the hull of its end and the embossing
      // around there, a hair inside its edges (faces lying on each other
      // overlap), never into its pockets.
      const beside = pocketsBeside(link);
      // Only into the embossing it ends at – a pupil's link not into the
      // ring around it as well, a ring's not into the pupil within.
      const flare = (at: Point, island: Island) => {
        const disk = (radius: number) =>
          track(track(CrossSection.circle(radius, SEGMENTS)).translate(at));
        const own = track(
          relief.intersect(
            track(
              new CrossSection(
                [island.ring, ...(island.inner ?? [])],
                "EvenOdd"
              )
            )
          )
        );
        // Rounded into it, in the corners between the two only – a hull
        // would span a ring's hollow inner edge with a wedge.
        const reach = bridgeWidth * FLARE;
        const near = track(own.intersect(disk(reach)));
        // Without the dust closing leaves along the edges, then a hair into
        // the embossing (faces lying on each other overlap).
        const joint = grow(
          grow(
            track(
              track(
                close(
                  track(track(link.intersect(disk(reach))).add(near)),
                  bridgeWidth / 2
                ).intersect(disk(reach))
              ).subtract(near)
            ),
            -2 * DUST
          ),
          4 * DUST
        );
        // Only the corners at the link – not a hollow of the embossing
        // itself nearby (under an arch), which closing fills as well.
        const corners = apart(joint)
          .map(track)
          .filter((piece) => !track(piece.intersect(link)).isEmpty());
        if (corners.length === 0) return link;
        const kept = track(CrossSection.union(corners));
        return beside ? track(kept.subtract(beside)) : kept;
      };
      const ends = [
        link,
        ...(start.relief ? [flare(from, start)] : []),
        ...(end.relief ? [flare(to, end)] : []),
      ];
      plain.push(
        track(track(CrossSection.union(ends)).intersect(cookieAndWalls))
      );
    }
    const pieces = [...outer, ...inner, ...links, ...plain];
    let plate: CrossSection | null = null;
    if (pieces.length > 0) {
      const joined = track(CrossSection.union(pieces));
      /**
       * What closing `of` by `radius` adds over the cookie up to `reach` from
       * `around` – the plate cut out wide enough that its cut edges stay out.
       */
      const gaps = (
        of: CrossSection,
        radius: number,
        around: CrossSection,
        reach: number
      ) => {
        const near = track(of.intersect(grow(around, reach + radius)));
        return track(
          track(
            track(close(near, radius).subtract(near)).intersect(
              grow(around, reach)
            )
          ).intersect(cookieAndWalls)
        );
      };
      const linked = track(CrossSection.union(links));
      const fillets =
        links.length > 0 ? gaps(joined, FILLET, linked, FILLET) : linked;
      // The embossing's links round off onto it as well – without the dust
      // along its edges, then a hair into it (faces lying on each other
      // overlap), never into its pockets: closing there would fill them.
      const plainLinks =
        plain.length > 0 ? track(CrossSection.union(plain)) : null;
      const roundings =
        relief && reliefPockets && plainLinks
          ? track(
              track(
                grow(
                  grow(
                    gaps(track(joined.add(relief)), FILLET, plainLinks, FILLET),
                    -DUST
                  ),
                  2 * DUST
                ).subtract(reliefPockets)
              ).intersect(cookieAndWalls)
            )
          : null;
      // Only what rounds off a link – not a hollow of the embossing itself
      // near one (under an arch), which closing fills as well.
      const rounding = (roundings ? apart(roundings) : [])
        .map(track)
        .filter(
          (piece) =>
            plainLinks &&
            !track(grow(piece, DUST).intersect(plainLinks)).isEmpty()
        );
      const onEmbossing =
        rounding.length > 0 ? track(CrossSection.union(rounding)) : null;
      const rounded = track(
        joined.add(onEmbossing ? track(fillets.add(onEmbossing)) : fillets)
      );
      // Only next to inner pieces – narrow cookie along the outside (tips,
      // thin arms) stays open from above. Offsetting curves leaves dust.
      // Closed after the fillets: where one fills a narrow strip, it ends
      // straight across, and its corners are rounded off here too.
      const innerPieces = track(
        CrossSection.union([
          ...inner,
          ...links,
          ...plain,
          fillets,
          ...(onEmbossing ? [onEmbossing] : []),
        ])
      );
      // Slits between the plate and embossing too – never in its pockets.
      const closing = relief ? track(rounded.add(relief)) : rounded;
      const hairlines = apart(
        gaps(closing, HAIRLINE / 2, innerPieces, HAIRLINE)
      )
        .map(track)
        .filter(
          (gap) =>
            gap.area() > 0.01 &&
            !track(grow(gap, 0.05).intersect(innerPieces)).isEmpty()
        )
        .map((gap) =>
          reliefPockets ? track(gap.subtract(reliefPockets)) : gap
        );
      const filled = track(rounded.add(track(CrossSection.union(hairlines))));
      // Cookie along the outside is open to the rim, a pocket is not.
      const roots = track(
        CrossSection.union(
          islands.filter(({ depth }) => depth === 0).map(areaOf)
        )
      );
      const rim = track(grow(roots, 0.05).subtract(grow(roots, -0.05)));
      const embossing = track(
        CrossSection.union(relief ? [...plain, relief] : plain)
      );
      const plugs = apart(track(shape.subtract(filled)))
        .map(track)
        .filter((pocket) => track(pocket.intersect(rim)).isEmpty())
        .flatMap((pocket) => {
          if (!track(grow(pocket, DUST).intersect(embossing)).isEmpty()) {
            return grow(pocket, -HAIRLINE / 2).isEmpty() ? [pocket] : [];
          }
          return pocket.area() < POCKET
            ? [pocket]
            : [
                track(
                  pocket.subtract(
                    grow(grow(grow(pocket, -FILLET), FILLET), DUST)
                  )
                ),
              ];
        });
      // Pieces that only share an edge can be joined by a crack of no width
      // – printed, the plate would fall apart along it. Closed.
      plate = close(track(filled.add(track(CrossSection.union(plugs)))), DUST);
      parts.push(track(plate.extrude(flangeHeight)));
    }

    let embossId: number | null = null;
    if (relief) {
      // Filled straight up from the bed, `relief` out of the flange – no
      // foot: the embossing is a filled area, it stands on its own.
      const height = flangeHeight + reliefReach(params);
      const pads = track(track(relief.extrude(height)).asOriginal());
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
      const kept = apart(poured)
        .map(track)
        .filter((part) => part.area() > area * ICING_CRUMB);
      return track(CrossSection.union(kept));
    };
    const inset = Math.min(6, Math.max(1.5, params.size * ICING_INSET));
    let icing = pour(inset);
    if (icing.area() < area * ICING_SHARE) icing = pour(inset / 2);
    const iced = icing.area() >= area * ICING_SHARE;
    // The embossing pressed into the dough, a little inside its edge – the
    // icing keeps clear of it, so the imprint shows.
    const imprint = relief
      ? track(relief.intersect(grow(shape, -IMPRINT_RIM)))
      : null;
    if (iced && imprint && !imprint.isEmpty()) {
      const clear = track(icing.subtract(grow(imprint, IMPRINT_RIM)));
      icing = track(
        CrossSection.union(
          apart(clear)
            .map(track)
            .filter((part) => part.area() > area * ICING_CRUMB)
        )
      );
    }
    // Icing in the imprint, its corners rounded a little; none where the
    // imprint is too narrow for it.
    let inlay: CrossSection | null = null;
    if (imprint && !imprint.isEmpty()) {
      const inset = params.size * INLAY_INSET;
      const poured = apart(grow(grow(imprint, -1.25 * inset), 0.25 * inset))
        .map(track)
        .filter((part) => part.area() > area * ICING_CRUMB * 0.1);
      if (poured.length > 0) inlay = track(CrossSection.union(poured));
    }
    const normalised = (section: CrossSection | null) =>
      section ? section.toPolygons().map((ring) => ring.map(fromMm)) : [];
    return {
      manifold,
      outline: normalised(shape),
      icing: iced ? normalised(icing) : [],
      imprint: normalised(imprint),
      inlay: normalised(inlay),
      connections,
      emboss: embossId,
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
