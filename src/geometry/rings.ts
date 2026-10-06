import type { Point, Ring } from "./outline";

/** Plain 2D helpers for closed rings (counter-clockwise = positive area). */

export const signedArea = (ring: Ring) => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
};

export const centroid = (ring: Ring): Point => {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return area === 0 ? ring[0] : [cx / (3 * area), cy / (3 * area)];
};

export const perimeter = (ring: Ring) =>
  ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length];
    return sum + Math.hypot(nx - x, ny - y);
  }, 0);

export const distance = (a: Point, b: Point) =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Point in polygon (ray casting). */
export const contains = (ring: Ring, [x, y]: Point) => {
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

export const closestOnSegment = (
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

export const closestOnRing = (point: Point, ring: Ring): Point => {
  let best: Point = ring[0];
  let bestDistance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const candidate = closestOnSegment(
      point,
      ring[i],
      ring[(i + 1) % ring.length]
    );
    const gap = distance(candidate, point);
    if (gap < bestDistance) {
      bestDistance = gap;
      best = candidate;
    }
  }
  return best;
};

export const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
  const cross = (p: Point, q: Point, r: Point) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
};

/** Distance between two segments (0 if they cross). */
export const segmentDistance = (a: Point, b: Point, c: Point, d: Point) => {
  if (segmentsCross(a, b, c, d)) return 0;
  const gap = (p: Point, from: Point, to: Point) =>
    distance(closestOnSegment(p, from, to), p);
  return Math.min(gap(a, c, d), gap(b, c, d), gap(c, a, b), gap(d, a, b));
};

/** Does the segment cross the ring? Its very ends do not count. */
export const crossesRing = (from: Point, to: Point, ring: Ring) => {
  const length = distance(from, to) || 1;
  const ux = (to[0] - from[0]) / length;
  const uy = (to[1] - from[1]) / length;
  const a: Point = [from[0] + ux * 0.05, from[1] + uy * 0.05];
  const b: Point = [to[0] - ux * 0.05, to[1] - uy * 0.05];
  return ring.some((point, i) =>
    segmentsCross(a, b, point, ring[(i + 1) % ring.length])
  );
};

/**
 * How far a ray from `from` in direction `dir` (unit length) gets until it hits
 * the ring, and at which angle: `square` is 1 for a perpendicular hit, 0 for a
 * grazing one.
 */
export const rayHit = (from: Point, [dx, dy]: Point, ring: Ring) => {
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

/**
 * Points every `step` along a closed ring, each with its outward normal (for
 * a counter-clockwise ring).
 */
export const resample = (ring: Ring, step: number) => {
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
  return points.map((point, i) => {
    const before = points[(i - 1 + points.length) % points.length];
    const after = points[(i + 1) % points.length];
    const tx = after[0] - before[0];
    const ty = after[1] - before[1];
    const norm = Math.hypot(tx, ty) || 1;
    const normal: Point = [ty / norm, -tx / norm];
    return { point, normal };
  });
};

/** The segments of a ring that come within `reach` of a box – flat x/y pairs. */
export const segmentsNear = (
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
export const nearestOn = (segments: number[], x: number, y: number) => {
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
    const gap = ex * ex + ey * ey;
    if (gap < best) {
      best = gap;
      inside = dx * (y - ay) - dy * (x - ax) > 0;
    }
  }
  return { distance: Math.sqrt(best), inside };
};
