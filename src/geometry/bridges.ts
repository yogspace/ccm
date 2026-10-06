import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./outline";
import {
  contains,
  distance,
  nearestOn,
  segmentsNear,
  signedArea,
} from "./rings";

/** Radius (mm) of the fillets with which bridges and links blend in. */
export const FILLET = 2.5;
/** Height of a bridge in the middle; towards the walls it rises. */
export const BRIDGE_MID_HEIGHT = 3;
/**
 * How much higher the ends are grows with the span – short bridges stay low
 * instead of turning into a block.
 */
const RISE_PER_MM = 0.25;

/** Manifold and the cleanup list of the cutter being built. */
export type Scope = {
  wasm: ManifoldToplevel;
  track: <T extends CrossSection | Manifold>(object: T) => T;
};

/** Rectangle along `dir` (unit length): from `start` to `end` mm past `from`. */
export const strip = (
  { wasm, track }: Scope,
  from: Point,
  [ux, uy]: Point,
  start: number,
  end: number,
  width: number
) => {
  const hx = (-uy * width) / 2;
  const hy = (ux * width) / 2;
  const [ax, ay] = [from[0] + ux * start, from[1] + uy * start];
  const [bx, by] = [from[0] + ux * end, from[1] + uy * end];
  return track(
    new wasm.CrossSection(
      [
        [
          [ax + hx, ay + hy],
          [bx + hx, by + hy],
          [bx - hx, by - hy],
          [ax - hx, ay - hy],
        ],
      ],
      "NonZero"
    )
  );
};

/**
 * A contour a bridge runs into. `beyondInside`: seen from the bridge, what
 * lies beyond the contour (wall and more) is inside it.
 */
export type Face = { ring: Ring; beyondInside: boolean };

export type Arch = {
  from: Point;
  to: Point;
  faces: [Face, Face];
  /** For cookie in a hole both walls lie in the gap, this thick; else 0. */
  inset: number;
  /** Where the bridge may be in plan. */
  allowed: CrossSection;
};

export type ArchStyle = {
  width: number;
  /** Height in the middle. */
  midHeight: number;
  /** Highest point, fillet included – the dough needs its room. */
  ceiling: number;
  wall: number;
  /** All walls in plan. */
  walls: CrossSection;
};

/**
 * A bridge at the flange (on top in use, far from the dough; on the bed when
 * printing): a straight band under an arch, low in the middle and rising to
 * the walls, meeting them vertically. In plan its corners at the walls are
 * rounded off (by the real distance to the wall, so also where it is oblique
 * or curved), and these fillets slope down away from the bridge – no edge
 * where it joins.
 */
export const buildArch = (
  scope: Scope,
  { width, midHeight, ceiling, wall, walls }: ArchStyle,
  { from, to, faces, inset, allowed }: Arch
): Manifold | null => {
  const { wasm, track } = scope;
  const soft = (section: CrossSection, delta: number) =>
    track(section.offset(delta, "Round", 2, 16));
  const span = distance(from, to);
  if (span <= 0) return null;
  const dir: Point = [(to[0] - from[0]) / span, (to[1] - from[1]) / span];
  const [nx, ny] = [-dir[1], dir[0]];
  const half = width / 2;
  const riseHeight = Math.min(FILLET, (ceiling - midHeight) / 2);
  // Long enough to reach through any wall, then cut to the wall faces.
  const extend = wall + 2;

  // Only the piece that really spans between the two contours: at a notch
  // the extension could poke into another bit of wall and stay there as a
  // loose block.
  const reaching = track(
    strip(scope, from, dir, -extend, span + extend, width).intersect(allowed)
  );
  const middle: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const band = reaching
    .decompose()
    .map(track)
    .find((piece) =>
      piece
        .toPolygons()
        .some((ring) => signedArea(ring) > 0 && contains(ring, middle))
    );
  if (!band) return null;

  // Plan: band plus rounded corners at the walls (closing: grow, then
  // shrink), kept outside the walls – rounding errors leave paper-thin
  // slivers along them, dropped – plus a slight overlap into the walls and
  // the band running through them.
  const near = track(walls.intersect(soft(band, 4 * FILLET)));
  const closed = track(
    track(track(near.add(band)).offset(FILLET, "Round", 2, 48)).offset(
      -FILLET,
      "Round",
      2,
      48
    )
  );
  const outside = track(
    track(closed.intersect(soft(band, 2 * FILLET))).subtract(walls)
  );
  const free = track(
    wasm.CrossSection.union(
      outside
        .decompose()
        .map(track)
        .filter((piece) => piece.area() > 0.05)
    )
  );
  const footprint = track(
    track(
      track(free.add(track(soft(free, 0.3).intersect(walls)))).add(
        track(band.intersect(walls))
      )
    ).intersect(allowed)
  );

  const endHeight = Math.min(
    ceiling - riseHeight,
    midHeight + span * RISE_PER_MM
  );
  // Height field over the plan, from the real distance to the two wall faces
  // the bridge joins: sagging like a rope towards the middle, and at each
  // wall (also a curved one) a fillet that sweeps steeply up into it; beside
  // the band the fillets slope down. Inside a wall everything is at full
  // height, so no ridge forms at its face.
  const gap = Math.max(span - 2 * inset, 1);
  const { min, max } = footprint.bounds();
  const reach = gap / 2 + inset + 1;
  const ends = faces.map(({ ring, beyondInside }) => ({
    segments: segmentsNear(ring, min, max, reach),
    beyondInside,
  }));
  const height = (x: number, y: number) => {
    let d = Infinity;
    for (const { segments, beyondInside } of ends) {
      const { distance, inside } = nearestOn(segments, x, y);
      d = Math.min(d, inside === beyondInside ? 0 : distance);
    }
    d = Math.max(0, d - inset);
    const t = Math.min(0.5, d / gap);
    const sag = midHeight + (endHeight - midHeight) * (1 - 2 * t) ** 2;
    const rise = d < FILLET ? riseHeight * (1 - d / FILLET) ** 2 : 0;
    let h = sag + rise;
    const side = Math.abs((x - from[0]) * nx + (y - from[1]) * ny);
    if (side > half) {
      const s = Math.min(1, (side - half) / FILLET);
      h *= (1 - s) ** 2;
    }
    return Math.max(h, 0.3);
  };
  // Extruded to 1 mm, finely divided, then each point pulled up to its
  // height – one smooth solid.
  const flanks = strip(
    scope,
    from,
    dir,
    -extend - 2 * FILLET,
    span + extend + 2 * FILLET,
    width + 2 * FILLET
  );
  const bar = track(
    track(
      track(track(footprint.intersect(flanks)).extrude(1)).refineToLength(0.5)
    ).warpBatch((verts, count) => {
      for (let i = 0; i < count; i++) {
        verts[i * 3 + 2] *= height(verts[i * 3], verts[i * 3 + 1]);
      }
    })
  );
  // Only the connected main piece – rounding can leave splinters at the ends
  // that would otherwise float as loose parts.
  const main = bar
    .decompose()
    .map(track)
    .reduce<Manifold | null>(
      (best, piece) => (!best || piece.volume() > best.volume() ? piece : best),
      null
    );
  return main && !main.isEmpty() ? main : null;
};
