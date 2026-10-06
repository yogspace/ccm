import { type Island, isHole } from "./islands";
import type { Point, Ring } from "./outline";
import {
  centroid,
  closestOnRing,
  crossesRing,
  distance,
  perimeter,
  rayHit,
  resample,
  segmentDistance,
} from "./rings";

/**
 * What holds an inner contour (`start`) to the contour around it or to a
 * neighbour (`end`), from `from` on the one to `to` on the other.
 */
export type Connection = {
  from: Point;
  to: Point;
  length: number;
  start: Island;
  end: Island;
  /**
   * `flat`: a link at flange height, part of the flange plate.
   * `arch`: a bridge that rises into both walls.
   */
  kind: "flat" | "arch";
};

export type PlanOptions = {
  /** How far (mm) the flange reaches from an inner contour into the cookie. */
  innerFlange: number;
  /**
   * Flanges closer than this (mm) are linked: those of neighbouring holes
   * always, those near the wall when a support is needed there.
   */
  join: number;
  /** Longest open span (mm) that is still bridged flat. */
  flatSpan: number;
  /** Width of links and bridges. */
  width: number;
  /** Radius of the fillets where links meet flanges and walls. */
  fillet: number;
};

/** Spacing (mm) of the spots where a connection may start. */
const SAMPLE = 1.5;
/** Spacing (mm) of the spots checked for contact between flanges. */
const CONTACT_SAMPLE = 1;
/** How far (degrees) a connection may deviate from square to its contours. */
const MAX_TILT = 35;
/** About one support per this many mm around a group (its hull), 2 to 4. */
const SPACING = 45;
/** Groups up to this size (mm) are held well enough at a single spot. */
const SMALL_GROUP = 10;
/**
 * Arches should not come closer (mm, plus twice their width) – with their
 * fillets they would merge into a block. Flat links only keep their fillets
 * apart.
 */
const GAP = 6;
/** An arch counts as this much (mm) longer than a flat link. */
const ARCH_COST = 3;
/** Extra cost (mm) for a support right next to another instead of opposite. */
const SPREAD_COST = 10;
/** Cost of a connection that crowds another – only if there is no other way. */
const CROWDED_COST = 1000;
/** Supports are compared per direction, in this many sectors around a group. */
const DIRECTIONS = 36;

type Candidate = Connection & { cost: number };

/** Inner contours that hang together over their flanges – one rigid piece. */
type Group = {
  members: Island[];
  center: Point;
  /** How many supports it needs, spread around it. */
  needed: number;
  /** The connections holding it (for spacing). */
  attached: Connection[];
};

const box = (ring: Ring) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
};

/** Convex hull (monotone chain), counter-clockwise. */
const hull = (points: Point[]): Ring => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (from: Point[]) => {
    const chain: Point[] = [];
    for (const point of from) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      ) {
        chain.pop();
      }
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
};

/** Gap between the bounding boxes of two rings (0 if they overlap). */
const boxGap = (a: Ring, b: Ring) => {
  const p = box(a);
  const q = box(b);
  return Math.hypot(
    Math.max(0, p.minX - q.maxX, q.minX - p.maxX),
    Math.max(0, p.minY - q.maxY, q.minY - p.maxY)
  );
};

/**
 * Where `a` comes closer than `within` to `b`: one connection per stretch,
 * at its closest spot – unless it would cross a contour.
 */
const contactsBetween = (
  a: Island,
  b: Island,
  within: number,
  rings: Ring[]
): Connection[] => {
  if (boxGap(a.ring, b.ring) >= within) return [];
  const near = resample(a.ring, CONTACT_SAMPLE).map(({ point }) => {
    const to = closestOnRing(point, b.ring);
    return { from: point, to, length: distance(point, to) };
  });
  const contacts: Connection[] = [];
  const close = (best: (typeof near)[number] | null) => {
    if (best && !rings.some((ring) => crossesRing(best.from, best.to, ring))) {
      contacts.push({ ...best, start: a, end: b, kind: "flat" });
    }
  };
  // Start the walk somewhere apart, so no stretch is split at the seam.
  const apart = near.findIndex(({ length }) => length >= within);
  let best: (typeof near)[number] | null = null;
  for (let k = 0; k < near.length; k++) {
    const sample = near[(Math.max(apart, 0) + k) % near.length];
    if (sample.length < within) {
      if (!best || sample.length < best.length) best = sample;
    } else {
      close(best);
      best = null;
    }
  }
  close(best);
  return contacts;
};

const angleBetween = (a: number, b: number) => {
  const turn = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(turn, 2 * Math.PI - turn);
};

/**
 * Plans what holds the inner contours of `parent` (`children`): holes in
 * cookie, or cookie in a hole.
 *
 * 1. Flanges of neighbouring holes that come closer than `join` are linked
 *    flat – the closest pairs first, only as many as it takes to hold them
 *    together. Holes linked like this form a group, held as one piece.
 * 2. Every group gets its cheapest connection to something that is held
 *    already – the wall, or a group connected to it – the nearest groups
 *    first (like a minimum spanning tree). Where a flange comes close to
 *    the wall, that is a short flat link.
 * 3. Then each group gets further supports until they spread around it:
 *    two at least 90° apart, more for large groups. Again the cheapest:
 *    short, about square to both contours, flat rather than arched, and not
 *    crowding another connection.
 *
 * Short open spans become flat links, longer ones arches. Cookie in a hole is
 * only ever held by arches across the opening, never joined.
 */
const planInside = (
  parent: Island,
  children: Island[],
  planned: Connection[],
  options: PlanOptions
) => {
  const overOpening = isHole(parent);
  /** How far an island's flange reaches into the gap between contours. */
  const reach = (island: Island) =>
    !overOpening && island.depth > 0 ? options.innerFlange : 0;
  /** How far apart two connections must stay. */
  const spacing = (a: Connection, b: Connection) =>
    a.kind === "flat" && b.kind === "flat"
      ? options.width + 2 * options.fillet
      : GAP + 2 * options.width;
  const around = [parent, ...children];
  const rings = around.map((island) => island.ring);
  const maxTilt = Math.cos((MAX_TILT * Math.PI) / 180);

  // Where flanges come close: to each other, and to the parent's wall.
  const close: Connection[] = [];
  const wallward: Connection[] = [];
  if (!overOpening) {
    for (const [i, child] of children.entries()) {
      for (const other of [parent, ...children.slice(i + 1)]) {
        const within = options.join + reach(child) + reach(other);
        const found = contactsBetween(child, other, within, rings);
        (other === parent ? wallward : close).push(...found);
      }
    }
  }

  // 1. Link neighbouring flanges, the closest first – but only as many as it
  //    takes to hold them together (a spanning tree), no criss-cross. The
  //    holes linked like this form a group, held as one piece.
  const root = children.map((_, i) => i);
  const find = (i: number) => {
    let found = i;
    while (root[found] !== found) found = root[found];
    return found;
  };
  const links: Connection[] = [];
  for (const contact of close.sort((a, b) => a.length - b.length)) {
    const a = find(children.indexOf(contact.start));
    const b = find(children.indexOf(contact.end));
    if (a === b) continue;
    root[a] = b;
    links.push(contact);
  }
  const byRoot = new Map<number, Island[]>();
  for (const [i, child] of children.entries()) {
    byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), child]);
  }
  const groupOf = new Map<Island, Group>();
  const groups = [...byRoot.values()].map((members): Group => {
    let weight = 0;
    let cx = 0;
    let cy = 0;
    for (const { ring, area } of members) {
      const [x, y] = centroid(ring);
      cx += x * area;
      cy += y * area;
      weight += area;
    }
    const center: Point = [cx / weight, cy / weight];
    const bounds = members.map(({ ring }) => box(ring));
    const extent = Math.max(
      Math.max(...bounds.map((b) => b.maxX)) -
        Math.min(...bounds.map((b) => b.minX)),
      Math.max(...bounds.map((b) => b.maxY)) -
        Math.min(...bounds.map((b) => b.minY))
    );
    const around = perimeter(hull(members.flatMap(({ ring }) => ring)));
    const needed =
      extent <= SMALL_GROUP
        ? 1
        : Math.max(2, Math.min(4, Math.round(around / SPACING)));
    const group: Group = {
      members,
      center,
      needed,
      attached: [],
    };
    for (const member of members) groupOf.set(member, group);
    return group;
  });
  const anchored = new Set<Group>();

  /** Short open spans flat, longer ones arched; the cost of each. */
  const rate = (
    start: Island,
    from: Point,
    to: Point,
    end: Island
  ): Candidate => {
    const length = distance(from, to);
    const open = length - reach(start) - reach(end);
    const kind = !overOpening && open <= options.flatSpan ? "flat" : "arch";
    const cost = Math.max(open, 0) + (kind === "arch" ? ARCH_COST : 0);
    return { from, to, length, start, end, kind, cost };
  };
  /** Every way a group could be held: spokes and nearest spots. */
  const candidatesOf = (group: Group, strict: boolean) => {
    const found: Candidate[] = [];
    const add = (start: Island, from: Point, to: Point, end: Island) =>
      found.push(rate(start, from, to, end));
    for (const member of group.members) {
      for (const { point, normal } of resample(member.ring, SAMPLE)) {
        // Straight outwards, like a spoke – if it also meets what it reaches
        // about square (an oblique joint would leave a wedge) …
        let hit = { distance: Infinity, square: 0 };
        let target: Island | null = null;
        for (const island of around) {
          const next = rayHit(point, normal, island.ring);
          if (next.distance < hit.distance) {
            hit = next;
            target = island;
          }
        }
        if (
          target &&
          groupOf.get(target) !== group &&
          (!strict || hit.square >= maxTilt)
        ) {
          add(
            member,
            point,
            [
              point[0] + normal[0] * hit.distance,
              point[1] + normal[1] * hit.distance,
            ],
            target
          );
        }
        // … or to the nearest spot of a contour around, if not too oblique.
        for (const island of around) {
          if (groupOf.get(island) === group) continue;
          const to = closestOnRing(point, island.ring);
          const length = distance(point, to);
          const facing =
            ((to[0] - point[0]) * normal[0] + (to[1] - point[1]) * normal[1]) /
            (length || 1);
          if (facing < (strict ? maxTilt : 0)) continue;
          if (rings.some((ring) => crossesRing(point, to, ring))) continue;
          add(member, point, to, island);
        }
      }
    }
    return found;
  };
  const candidates = new Map(
    groups.map((group) => [group, candidatesOf(group, true)])
  );
  // Where a flange comes close to the wall, it is held most cheaply.
  for (const { start, from, to, end } of wallward) {
    const group = groupOf.get(start);
    if (group) candidates.get(group)?.push(rate(start, from, to, end));
  }

  const chosen: Connection[] = [];
  const choose = (connection: Connection) => {
    chosen.push(connection);
    for (const island of [connection.start, connection.end]) {
      groupOf.get(island)?.attached.push(connection);
    }
  };
  /** Would two supports of the same group converge or run side by side? */
  const converge = (a: Connection, b: Connection) =>
    // Spokes of a small shape start close together – fine, as long as they
    // spread out: their far ends at least the gap apart.
    distance(a.to, b.to) < spacing(a, b) ||
    segmentDistance(a.from, a.to, b.from, b.to) <
      0.9 * Math.min(spacing(a, b), distance(a.from, b.from));
  /** Too close to another connection? */
  const crowded = (candidate: Connection, own: Connection[]) =>
    [...planned, ...links, ...chosen].some(
      (other) =>
        !own.includes(other) &&
        segmentDistance(candidate.from, candidate.to, other.from, other.to) <
          spacing(candidate, other)
    ) || own.some((other) => converge(candidate, other));

  type Option = Candidate & { angle: number; score: number };
  /** The cheapest way in each direction to something held already. */
  const optionsOf = (group: Group) => {
    const best = new Map<number, Option>();
    for (const candidate of candidates.get(group) ?? []) {
      const target = groupOf.get(candidate.end);
      if (target && !anchored.has(target)) continue;
      const angle = Math.atan2(
        candidate.from[1] - group.center[1],
        candidate.from[0] - group.center[0]
      );
      const bin =
        Math.floor(((angle + Math.PI) / (2 * Math.PI)) * DIRECTIONS) %
        DIRECTIONS;
      const score =
        candidate.cost +
        (crowded(candidate, group.attached) ? CROWDED_COST : 0);
      const current = best.get(bin);
      if (!current || score < current.score) {
        best.set(bin, { ...candidate, angle, score });
      }
    }
    return [...best.values()];
  };
  /**
   * The cheapest `count` supports at least `separation` apart; spaced
   * evenly is best.
   */
  const bestSet = (options: Option[], count: number, separation: number) => {
    const ideal = (2 * Math.PI) / count;
    let best: Option[] = [];
    let bestScore = Infinity;
    const pick = (next: number, set: Option[]) => {
      if (set.length === count) {
        let score = 0;
        for (const option of set) {
          const nearest = Math.min(
            Math.PI,
            ...set
              .filter((other) => other !== option)
              .map((other) => angleBetween(option.angle, other.angle))
          );
          score +=
            option.score + SPREAD_COST * Math.max(0, 1 - nearest / ideal);
        }
        if (score < bestScore) {
          best = set;
          bestScore = score;
        }
        return;
      }
      for (let i = next; i < options.length; i++) {
        const option = options[i];
        const fits = set.every(
          (other) =>
            angleBetween(option.angle, other.angle) >= separation &&
            !converge(option, other)
        );
        if (fits) pick(i + 1, [...set, option]);
      }
    };
    pick(0, []);
    return best;
  };

  // 2. Hold the groups one by one, the one closest to what is held already
  //    first, each with the best set of supports spread around it (fewer if
  //    there is no way to spread them).
  for (;;) {
    const pending = groups.filter((group) => !anchored.has(group));
    if (pending.length === 0) break;
    let next: { group: Group; options: Option[] } | null = null;
    let nearest = Infinity;
    for (const group of pending) {
      const options = optionsOf(group);
      const cheapest = Math.min(...options.map(({ score }) => score));
      if (cheapest < nearest) {
        next = { group, options };
        nearest = cheapest;
      }
    }
    if (!next) {
      // Nothing about square: take the nearest way out at all.
      const group = pending[0];
      anchored.add(group);
      const way = candidatesOf(group, false)
        .filter(({ end }) => end === parent)
        .reduce<Candidate | null>(
          (shortest, candidate) =>
            !shortest || candidate.cost < shortest.cost ? candidate : shortest,
          null
        );
      if (way) choose(way);
      continue;
    }
    const { group, options } = next;
    const separation = Math.PI / group.needed;
    let set: Option[] = [];
    for (let count = group.needed; count > 0 && set.length === 0; count--) {
      set = bestSet(options, count, separation);
    }
    for (const { angle: _, score: __, ...connection } of set) {
      choose(connection);
    }
    anchored.add(group);
  }

  planned.push(...links, ...chosen);
};

/**
 * Plans all connections that hold the inner contours (see `planInside`).
 * Pure geometry on the contours – the solids are built from it later.
 */
export const planConnections = (islands: Island[], options: PlanOptions) => {
  const planned: Connection[] = [];
  for (const parent of islands) {
    const children = islands.filter((island) => island.parent === parent);
    if (children.length > 0) planInside(parent, children, planned, options);
  }
  return planned;
};
