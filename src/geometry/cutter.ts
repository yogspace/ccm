import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./outline";

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
};

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
};

export type Cutter = {
  /** Belongs to the caller, who must free it with `delete()`. */
  manifold: Manifold;
  /** Final contour in the same normalised coordinates as the input. */
  outline: Ring[];
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
/** Height of a bridge in the middle; towards the walls it rises. */
const BRIDGE_MID_HEIGHT = 3;
/**
 * Room (mm) the bridges always leave below the cutting edge for the dough –
 * nothing of them may press into the cookie.
 */
const BRIDGE_CLEARANCE = 9;
/**
 * How much higher the ends are grows with the span – short bridges stay low
 * instead of turning into a block.
 */
const BRIDGE_RISE_PER_MM = 0.25;
/** About one bridge per this many mm of the inner shape's perimeter, at least two. */
const BRIDGE_SPACING = 45;
/** Spacing of the spots where a bridge may start (mm). */
const BRIDGE_SAMPLE = 1.5;
/** How many mm of bridge length one mm closer to the middle of its section is worth. */
const BRIDGE_SPREAD = 0.6;
/** How far (degrees) a bridge may deviate from square to the inner shape. */
const BRIDGE_MAX_TILT = 35;
/**
 * Bridges should not come closer (mm, plus twice their width) – otherwise they
 * merge into a block together with their fillets.
 */
const BRIDGE_GAP = 6;
/** Radius (mm) of the fillets with which bridges blend into the walls. */
const BRIDGE_FILLET = 2.5;

const signedArea = (ring: Ring) => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

/** Point in polygon (ray casting). */
const contains = (ring: Ring, [x, y]: Point) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const closestOnSegment = (
  [px, py]: Point,
  [ax, ay]: Point,
  [bx, by]: Point
): Point => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t =
    length > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
      : 0;
  return [ax + t * dx, ay + t * dy];
};

const closestOnRing = (point: Point, ring: Ring): Point => {
  let best: Point = ring[0];
  let bestDistance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const candidate = closestOnSegment(
      point,
      ring[i],
      ring[(i + 1) % ring.length]
    );
    const distance = Math.hypot(
      candidate[0] - point[0],
      candidate[1] - point[1]
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
};

const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
  const cross = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
};

/** Distance between two segments (0 if they cross). */
const segmentDistance = (a: Point, b: Point, c: Point, d: Point) => {
  if (segmentsCross(a, b, c, d)) return 0;
  const gap = (p: Point, from: Point, to: Point) => {
    const [x, y] = closestOnSegment(p, from, to);
    return Math.hypot(x - p[0], y - p[1]);
  };
  return Math.min(gap(a, c, d), gap(b, c, d), gap(c, a, b), gap(d, a, b));
};

/**
 * How far a ray from `from` in direction `dir` (unit length) gets until it hits
 * the ring, and at which angle: `square` is 1 for a perpendicular hit, 0 for a
 * grazing one.
 */
const rayHitAt = (from: Point, [dx, dy]: Point, ring: Ring) => {
  let nearest = Infinity;
  let square = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const ex = bx - ax;
    const ey = by - ay;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const fx = ax - from[0];
    const fy = ay - from[1];
    const t = (fx * ey - fy * ex) / denominator;
    const u = (fx * dy - fy * dx) / denominator;
    if (t > 0.05 && u >= 0 && u <= 1 && t < nearest) {
      nearest = t;
      square = Math.abs(denominator) / (Math.hypot(ex, ey) || 1);
    }
  }
  return { distance: nearest, square };
};

/** How far a ray from `from` in direction `dir` (unit length) gets until it hits the ring. */
const rayHit = (from: Point, [dx, dy]: Point, ring: Ring) => {
  let nearest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const ex = bx - ax;
    const ey = by - ay;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const fx = ax - from[0];
    const fy = ay - from[1];
    const t = (fx * ey - fy * ex) / denominator;
    const u = (fx * dy - fy * dx) / denominator;
    if (t > 0.05 && u >= 0 && u <= 1 && t < nearest) nearest = t;
  }
  return nearest;
};

/** Points every `step` along a closed ring. */
const resample = (ring: Ring, step: number) => {
  const points: Point[] = [];
  let carry = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const length = Math.hypot(bx - ax, by - ay);
    let at = carry;
    while (at < length) {
      const t = at / length;
      points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      at += step;
    }
    carry = at - length;
  }
  return points;
};

const perimeter = (ring: Ring) =>
  ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length];
    return sum + Math.hypot(nx - x, ny - y);
  }, 0);

type Island = {
  ring: Ring;
  area: number;
  /** Index of the island this one lies inside, otherwise -1. */
  parent: number;
  /** 0 = outside, 1 = hole in it, 2 = cookie in the hole … */
  depth: number;
};

/** Orders the islands' outer contours: which lies inside which? */
const nestIslands = (exteriors: Ring[]): Island[] => {
  const islands: Island[] = exteriors.map((ring) => ({
    ring,
    area: signedArea(ring),
    parent: -1,
    depth: 0,
  }));
  for (const [i, island] of islands.entries()) {
    let smallest = Infinity;
    for (const [j, other] of islands.entries()) {
      if (i === j || other.area <= island.area || other.area >= smallest) {
        continue;
      }
      // Outer contours never cross – one point is enough.
      if (contains(other.ring, island.ring[0])) {
        smallest = other.area;
        island.parent = j;
      }
    }
  }
  const depthOf = (i: number): number =>
    islands[i].parent < 0 ? 0 : depthOf(islands[i].parent) + 1;
  for (const [i, island] of islands.entries()) island.depth = depthOf(i);
  return islands;
};

type Bridge = { from: Point; to: Point; length: number };

/**
 * Where the bridges of an inner shape start: spread evenly over its perimeter,
 * each running roughly square away from it (like spokes) to the enclosing
 * contour, without crossing another contour. Takes the bridges already placed
 * (`taken`) into account, so none runs into another. Returns segments from
 * inside to outside.
 */
const placeBridges = (
  inner: Ring,
  outer: Ring,
  obstacles: Ring[],
  taken: Bridge[],
  gap: number
) => {
  const samples = resample(inner, BRIDGE_SAMPLE);
  if (samples.length < 3) return [];
  const count = Math.max(
    2,
    Math.min(4, Math.round(perimeter(inner) / BRIDGE_SPACING))
  );
  const blockers = [inner, ...obstacles];
  const maxTilt = Math.cos((BRIDGE_MAX_TILT * Math.PI) / 180);
  /** Does the segment cross a contour? Slightly shortened, so the ends do not count. */
  const crosses = (from: Point, to: Point, length: number) => {
    const ux = (to[0] - from[0]) / (length || 1);
    const uy = (to[1] - from[1]) / (length || 1);
    const a: Point = [from[0] + ux * 0.05, from[1] + uy * 0.05];
    const b: Point = [to[0] - ux * 0.05, to[1] - uy * 0.05];
    return [outer, ...blockers].some((ring) =>
      ring.some((point, i) =>
        segmentsCross(a, b, point, ring[(i + 1) % ring.length])
      )
    );
  };

  const candidates = samples.map((from, i): Bridge | null => {
    // Outward normal (rings run counter-clockwise).
    const before = samples[(i - 1 + samples.length) % samples.length];
    const after = samples[(i + 1) % samples.length];
    const tx = after[0] - before[0];
    const ty = after[1] - before[1];
    const norm = Math.hypot(tx, ty) || 1;
    const normal: Point = [ty / norm, -tx / norm];
    const options: Bridge[] = [];
    // Straight outwards – if it also meets the enclosing wall about square
    // (an oblique joint would leave a crease) …
    const { distance: reach, square } = rayHitAt(from, normal, outer);
    if (
      Number.isFinite(reach) &&
      square >= maxTilt &&
      blockers.every((ring) => rayHit(from, normal, ring) >= reach)
    ) {
      options.push({
        from,
        to: [from[0] + normal[0] * reach, from[1] + normal[1] * reach],
        length: reach,
      });
    }
    // … or to the nearest spot, as long as that is not too oblique.
    const to = closestOnRing(from, outer);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const facing =
      ((to[0] - from[0]) * normal[0] + (to[1] - from[1]) * normal[1]) /
      (length || 1);
    if (facing >= maxTilt && !crosses(from, to, length)) {
      options.push({ from, to, length });
    }
    return options.reduce<Bridge | null>(
      (best, option) => (!best || option.length < best.length ? option : best),
      null
    );
  });

  /** Too close to another bridge? Bridges of the same shape just must not converge. */
  const crowded = (bridge: Bridge, others: Bridge[], own: Bridge[]) =>
    others.some(
      (other) =>
        segmentDistance(bridge.from, bridge.to, other.from, other.to) < gap
    ) ||
    own.some((other) => {
      const apart = Math.hypot(
        bridge.from[0] - other.from[0],
        bridge.from[1] - other.from[1]
      );
      // Spokes of a small shape start close together – fine, as long as they
      // spread out: they must neither converge nor run side by side, so
      // their far ends are at least the gap apart.
      const ends = Math.hypot(
        bridge.to[0] - other.to[0],
        bridge.to[1] - other.to[1]
      );
      return (
        ends < gap ||
        segmentDistance(bridge.from, bridge.to, other.from, other.to) <
          0.9 * Math.min(gap, apart)
      );
    });

  // Split the perimeter into `count` equal sections and take the best bridge
  // in each; choose the sections' offset so the bridges are shortest overall.
  let best: Bridge[] = [];
  let bestScore = Infinity;
  const tries = 12;
  for (let offset = 0; offset < tries; offset++) {
    const picked: Bridge[] = [];
    let score = 0;
    for (let part = 0; part < count; part++) {
      const start = Math.floor(
        ((part + offset / tries) / count) * samples.length
      );
      const end = Math.floor(
        ((part + 1 + offset / tries) / count) * samples.length
      );
      // Short, but as central in the section as possible and apart from the
      // others – close to one only if there is no other way.
      const middle = (start + end) / 2;
      let choice: Bridge | undefined;
      let choiceCost = Infinity;
      for (let k = start; k < end; k++) {
        const candidate = candidates[k % samples.length];
        if (!candidate) continue;
        const cost =
          candidate.length +
          BRIDGE_SPREAD * Math.abs(k - middle) * BRIDGE_SAMPLE +
          (crowded(candidate, taken, picked) ? 1000 : 0);
        if (cost < choiceCost) {
          choice = candidate;
          choiceCost = cost;
        }
      }
      if (choice) {
        picked.push(choice);
        score += choiceCost;
      } else {
        score += 1e6;
      }
    }
    if (score < bestScore) {
      bestScore = score;
      best = picked;
    }
  }
  return best;
};

type Neighbour = { from: Point; to: Point; distance: number };

/** The closest pair of points between an island's contour and its neighbours'. */
const nearestNeighbour = (
  island: { ring: Ring },
  others: { ring: Ring }[]
): Neighbour | null => {
  let best: Neighbour | null = null;
  for (const other of others) {
    for (const point of island.ring) {
      const to = closestOnRing(point, other.ring);
      const distance = Math.hypot(to[0] - point[0], to[1] - point[1]);
      if (!best || distance < best.distance) {
        best = { from: point, to, distance };
      }
    }
  }
  return best;
};

/** The segments of a ring that come within `reach` of a box – flat x/y pairs. */
const segmentsNear = (
  ring: Ring,
  [minX, minY]: readonly number[],
  [maxX, maxY]: readonly number[],
  reach: number
) => {
  const segments: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    if (
      Math.max(ax, bx) < minX - reach ||
      Math.min(ax, bx) > maxX + reach ||
      Math.max(ay, by) < minY - reach ||
      Math.min(ay, by) > maxY + reach
    ) {
      continue;
    }
    segments.push(ax, ay, bx, by);
  }
  return segments;
};

/**
 * Distance from a point to the nearest of these segments (Infinity if none),
 * and whether it lies inside the ring they belong to – rings run counter-
 * clockwise, so inside is to the left of the nearest segment.
 */
const nearestOn = (segments: number[], x: number, y: number) => {
  let best = Infinity;
  let inside = false;
  for (let i = 0; i < segments.length; i += 4) {
    const ax = segments[i];
    const ay = segments[i + 1];
    const dx = segments[i + 2] - ax;
    const dy = segments[i + 3] - ay;
    const length = dx * dx + dy * dy;
    const t =
      length > 0
        ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
        : 0;
    const ex = ax + t * dx - x;
    const ey = ay + t * dy - y;
    const distance = ex * ex + ey * ey;
    if (distance < best) {
      best = distance;
      inside = dx * (y - ay) - dy * (x - ax) > 0;
    }
  }
  return { distance: Math.sqrt(best), inside };
};

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
 * (with `cutouts`) an inner blade that cuts a hole, joined to the enclosing
 * blade by bridges at flange level.
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

    // Drop the strokes' holes only after closing the gaps: an almost closed
    // stroke should become a ring, not a double cutter.
    const { flangeHeight, bladeHeight, wall, edge } = params;
    const all = nestIslands(
      shape.toPolygons().filter((ring) => signedArea(ring) > 0)
    );
    const rootArea = all
      .filter((island) => island.depth === 0)
      .reduce((sum, island) => sum + island.area, 0);
    const minArea = rootArea * MIN_ISLAND_SHARE;
    const kept = new Set<number>();
    const keep = (i: number): boolean => {
      const island = all[i];
      if (island.area < (island.depth === 0 ? minArea : MIN_INNER_AREA)) {
        return false;
      }
      if (island.parent >= 0 && !kept.has(island.parent)) return false;
      if (island.depth > 0 && !params.cutouts) return false;
      // Holes too small for a wall stay cookie.
      if (island.depth % 2 === 1) {
        const room = grow(
          track(new CrossSection([island.ring], "Positive")),
          -(wall + 0.6)
        );
        if (room.isEmpty()) return false;
      }
      return true;
    };
    // Parents are always larger – sorted by area descending, the order is right.
    const order = [...all.keys()].sort((a, b) => all[b].area - all[a].area);
    for (const i of order) if (keep(i)) kept.add(i);
    const islands = [...kept].map((i) => all[i]);
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
    // The flange runs around the outside – and around every inner blade, but
    // there only over cookie and walls (on top in use, above the dough), never
    // over an opening: what a hole cuts out must still drop out. Close inner
    // shapes join up over their flanges and with the rim, supporting each
    // other.
    if (params.flangeWidth > wall) {
      const width = params.flangeWidth;
      const pieces = islands.map((island) => {
        const area = track(new CrossSection([island.ring], "Positive"));
        return island.depth === 0
          ? track(grow(area, width).subtract(area))
          : track(grow(area, width).subtract(grow(area, -width)));
      });
      const outer = pieces.filter((_, i) => islands[i].depth === 0);
      const inner = pieces.filter((_, i) => islands[i].depth > 0);
      const flange = track(
        track(CrossSection.union(outer)).add(
          track(track(CrossSection.union(inner)).intersect(grow(shape, wall)))
        )
      );
      parts.push(track(flange.extrude(flangeHeight)));
    }

    // Bridges sit at the flange (on top in use, far from the dough; on the bed
    // when printing). Each one is a straight band under an arch: low in the
    // middle, rising to the walls and meeting them vertically. In plan its
    // corners at the walls are rounded off (by the real distance to the wall,
    // so also where it is oblique or curved), and these fillets slope down
    // away from the bridge like a fillet would – no edge where it joins.
    const bridgeWidth = Math.max(1, params.bridgeWidth);
    const midHeight = Math.max(BRIDGE_MID_HEIGHT, flangeHeight + 1);
    // Highest point of a bridge, fillet included: the dough needs its room.
    const ceiling = Math.max(midHeight + 1, top - BRIDGE_CLEARANCE);
    const riseHeight = Math.min(BRIDGE_FILLET, (ceiling - midHeight) / 2);
    // Long enough to reach through any wall, then cut to the wall faces.
    const extend = wall + 2;
    const soft = (section: CrossSection, delta: number) =>
      track(section.offset(delta, "Round", 2, 16));
    /** All walls in plan, below the taper where the bridges live. */
    const walls = track(grow(shape, wall).subtract(shape));
    /** Rectangle along a bridge: from `start` to `end` mm past `from`. */
    const strip = (
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
        new CrossSection(
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
    const taken: Bridge[] = [];
    /** Flat links between neighbouring holes, keyed by their end points. */
    const links = new Map<string, Neighbour>();
    for (const [index, island] of islands.entries()) {
      if (island.depth === 0) continue;
      const parent = all[island.parent];
      const obstacles = islands
        .filter((_, other) => other !== index && islands[other] !== parent)
        .map((other) => other.ring);
      // Where a bridge may be: between both contours including their walls.
      // A hole's wall grows inwards, the enclosing one outwards; for cookie
      // inside a hole both walls lie in the hole.
      const parentArea = track(new CrossSection([parent.ring], "Positive"));
      const childArea = track(new CrossSection([island.ring], "Positive"));
      const allowed = track(
        island.depth % 2 === 1
          ? grow(parentArea, wall).subtract(grow(childArea, -wall))
          : parentArea.subtract(childArea)
      );
      const placed = placeBridges(
        island.ring,
        parent.ring,
        obstacles,
        taken,
        // Wider bridges keep proportionally more distance.
        BRIDGE_GAP + 2 * bridgeWidth
      );
      // Every hole keeps an arched bridge to a wall – the shortest. A further
      // one gives way to a flat link at flange height when a neighbouring
      // hole's flange is closer than the wall; flanges that already touch
      // need none. (Flanges sit on top in use, above the dough.)
      const arched = [...placed].sort((a, b) => a.length - b.length);
      if (island.depth % 2 === 1 && arched.length > 1) {
        const neighbour = nearestNeighbour(
          island,
          islands.filter(
            (other) =>
              other !== island &&
              other.depth === island.depth &&
              other.parent === island.parent
          )
        );
        if (neighbour) {
          const reachable =
            neighbour.distance - params.flangeWidth < arched[1].length;
          if (reachable) {
            arched.splice(1);
            const key = [neighbour.from, neighbour.to]
              .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
              .sort()
              .join("|");
            const apart = neighbour.distance > 2 * params.flangeWidth;
            if (apart && !links.has(key)) links.set(key, neighbour);
          }
        }
      }
      taken.push(...arched);
      for (const { from, to } of arched) {
        const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (span <= 0) continue;
        const dir: Point = [(to[0] - from[0]) / span, (to[1] - from[1]) / span];
        const [nx, ny] = [-dir[1], dir[0]];
        const half = bridgeWidth / 2;
        const band0 = track(
          strip(from, dir, -extend, span + extend, bridgeWidth).intersect(
            allowed
          )
        );
        // Only the piece that really spans between the two contours: at a
        // notch the extension could poke into another bit of wall and stay
        // there as a loose block.
        const middle: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
        const pieces = band0.decompose();
        garbage.push(...pieces);
        const band = pieces.find((piece) =>
          piece
            .toPolygons()
            .some((ring) => signedArea(ring) > 0 && contains(ring, middle))
        );
        if (!band) continue;

        // Plan: band plus rounded corners at the walls (closing: grow, then
        // shrink), kept outside the walls – rounding errors leave paper-thin
        // slivers along them, dropped – plus a slight overlap into the walls
        // and the band running through them.
        const near = track(walls.intersect(soft(band, 4 * BRIDGE_FILLET)));
        const closed = track(
          track(
            track(near.add(band)).offset(BRIDGE_FILLET, "Round", 2, 48)
          ).offset(-BRIDGE_FILLET, "Round", 2, 48)
        );
        const outside = track(
          track(closed.intersect(soft(band, 2 * BRIDGE_FILLET))).subtract(walls)
        );
        const kept = outside.decompose();
        garbage.push(...kept);
        const free = track(
          CrossSection.union(kept.filter((piece) => piece.area() > 0.05))
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
          midHeight + span * BRIDGE_RISE_PER_MM
        );
        // Height field over the plan, from the real distance to the two wall
        // faces the bridge joins: sagging like a rope towards the middle, and
        // at each wall (also a curved one) a fillet that sweeps steeply up
        // into it; beside the band the fillets slope down. Inside a wall
        // everything is at full height, so no ridge forms at its face. A
        // cookie inside a hole has both walls on the bridge side of its
        // contours.
        const inset = island.depth % 2 === 0 ? wall : 0;
        const gap = Math.max(span - 2 * inset, 1);
        const { min, max } = footprint.bounds();
        const reach = gap / 2 + inset + 1;
        // Beyond the child contour lies its wall for a hole, the cookie for a
        // cookie in a hole – either way not the gap; beyond the parent's too.
        const faces = [
          {
            segments: segmentsNear(island.ring, min, max, reach),
            beyondInside: true,
          },
          {
            segments: segmentsNear(parent.ring, min, max, reach),
            beyondInside: false,
          },
        ];
        const height = (x: number, y: number) => {
          let d = Infinity;
          for (const { segments, beyondInside } of faces) {
            const { distance, inside } = nearestOn(segments, x, y);
            d = Math.min(d, inside === beyondInside ? 0 : distance);
          }
          d = Math.max(0, d - inset);
          const t = Math.min(0.5, d / gap);
          const sag = midHeight + (endHeight - midHeight) * (1 - 2 * t) ** 2;
          const rise =
            d < BRIDGE_FILLET ? riseHeight * (1 - d / BRIDGE_FILLET) ** 2 : 0;
          let h = sag + rise;
          const side = Math.abs((x - from[0]) * nx + (y - from[1]) * ny);
          if (side > half) {
            const s = Math.min(1, (side - half) / BRIDGE_FILLET);
            h *= (1 - s) ** 2;
          }
          return Math.max(h, 0.3);
        };
        // Extruded to 1 mm, finely divided, then each point pulled up to its
        // height – one smooth solid per bridge.
        const flanks = strip(
          from,
          dir,
          -extend - 2 * BRIDGE_FILLET,
          span + extend + 2 * BRIDGE_FILLET,
          bridgeWidth + 2 * BRIDGE_FILLET
        );
        const bar = track(
          track(
            track(track(footprint.intersect(flanks)).extrude(1)).refineToLength(
              0.5
            )
          ).warpBatch((verts, count) => {
            for (let i = 0; i < count; i++) {
              verts[i * 3 + 2] *= height(verts[i * 3], verts[i * 3 + 1]);
            }
          })
        );
        // Only the connected main piece – rounding can leave splinters at the
        // ends that would otherwise float as loose parts.
        const solids = bar.decompose();
        garbage.push(...solids);
        const main = solids.reduce<Manifold | null>(
          (best, piece) =>
            !best || piece.volume() > best.volume() ? piece : best,
          null
        );
        if (main && !main.isEmpty()) parts.push(main);
      }
    }

    // Flat links: a band between two holes at flange height, reaching into
    // both walls, never over an opening.
    const cookieAndWalls = grow(shape, wall);
    for (const { from, to, distance } of links.values()) {
      const dir: Point = [
        (to[0] - from[0]) / distance,
        (to[1] - from[1]) / distance,
      ];
      const band = track(
        strip(from, dir, -wall, distance + wall, bridgeWidth).intersect(
          cookieAndWalls
        )
      );
      if (!band.isEmpty()) {
        parts.push(track(band.extrude(Math.max(flangeHeight, 1))));
      }
    }

    // Rounding can leave zero-volume splinters as parts of their own; real
    // separate pieces (e.g. letters side by side) are far larger. The result
    // is composed fresh: it belongs to the caller, not to `garbage`.
    const pieces = track(Manifold.union(parts)).decompose();
    garbage.push(...pieces);
    return {
      manifold: Manifold.compose(pieces.filter((piece) => piece.volume() > 1)),
      outline: shape.toPolygons().map((ring) => ring.map(fromMm)),
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
