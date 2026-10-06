import type { CrossSection, Manifold, ManifoldToplevel } from "manifold-3d";
import type { Point, Ring } from "./outline";

/** Alle Maße in Millimetern. */
export type CutterParams = {
  /** Längste Seite der Kontur. */
  size: number;
  /** Klingenhöhe ab Oberkante Falz. */
  bladeHeight: number;
  /** Wandstärke unten an der Falz. */
  wall: number;
  /** Wandstärke oben an der Schneide. */
  edge: number;
  /** Bereich unter der Schneide, in dem die Wand dünner wird. */
  taper: number;
  flangeWidth: number;
  flangeHeight: number;
  /** Schließt Lücken bis zu diesem Radius (morphologisches Closing). */
  smoothing: number;
  /** 1 = Formen in Formen werden zu inneren Klingen (Löcher), 0 = nur außen. */
  cutouts: number;
};

export const defaultParams: CutterParams = {
  size: 80,
  bladeHeight: 15,
  wall: 1.2,
  edge: 0.6,
  // Kurz halten: Je länger der dünne Bereich, desto leichter bricht die Schneide.
  taper: 1.6,
  flangeWidth: 5,
  flangeHeight: 2,
  smoothing: 1,
  cutouts: 1,
};

export type Cutter = {
  /** Gehört dem Aufrufer, der es mit `delete()` freigeben muss. */
  manifold: Manifold;
  /** Finale Kontur in denselben normierten Koordinaten wie die Eingabe. */
  outline: Ring[];
};

/** Schichthöhe, in der die Verjüngung abgestuft wird – im Druck unsichtbar. */
const LAYER = 0.2;
/** Stufen überlappen minimal, sonst bleiben sie getrennte Teile im Export. */
const OVERLAP = 0.01;
const SEGMENTS = 48;
/** Außen: Teile unter diesem Anteil der Gesamtfläche gelten als Krümel. */
const MIN_ISLAND_SHARE = 0.01;
/** Innen (Löcher, Formen in Formen) zählt die echte Größe, nicht der Anteil (mm²). */
const MIN_INNER_AREA = 6;
/** Bridges between inner and outer blades (mm): this wide … */
const BRIDGE_WIDTH = 3;
/** Höhe in der Mitte des Stegs; an den Wänden wird er höher (siehe bridgeProfile). */
const BRIDGE_MID_HEIGHT = 3;
/** Anteil der Gesamthöhe, bis zu dem der Steg an den Wänden höchstens hochgeht. */
const BRIDGE_END_SHARE = 0.45;
/**
 * Wie stark die Enden ausgestellt sind, wächst mit der Spannweite – kurze Stege
 * bleiben schlank statt zum Klotz zu werden.
 */
const BRIDGE_RISE_PER_MM = 0.25;
/** Etwa ein Steg je so viel mm Umfang der inneren Form, mindestens zwei. */
const BRIDGE_SPACING = 45;
/** Abstand der Stellen, an denen ein Steg ansetzen darf (mm). */
const BRIDGE_SAMPLE = 1.5;
/** Wie viel mm Steglänge ein mm näher an der Mitte seines Abschnitts wert ist. */
const BRIDGE_SPREAD = 0.6;
/** So weit (Grad) darf ein Steg von der Senkrechten auf die innere Form abweichen. */
const BRIDGE_MAX_TILT = 35;
/**
 * Näher (mm) sollen sich Stege nicht kommen – sonst verschmelzen sie samt
 * ihren ausgestellten Enden zu einem Klotz.
 */
const BRIDGE_GAP = 12;
/** Radius (mm) der Hohlkehlen, mit denen die Stege in die Wände übergehen. */
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

/** Punkt-in-Polygon (Strahlverfahren). */
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

/** Abstand zweier Strecken (0, wenn sie sich kreuzen). */
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

/** Wie weit ein Strahl von `from` in Richtung `dir` (Länge 1) bis zum Ring kommt. */
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

/** Punkte im Abstand `step` entlang eines geschlossenen Rings. */
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
  /** Index der Insel, in deren Innerem diese liegt, sonst -1. */
  parent: number;
  /** 0 = außen, 1 = Loch darin, 2 = Keks im Loch … */
  depth: number;
};

/** Ordnet die Außenkonturen der Inseln: Welche liegt in welcher? */
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
      // Außenkonturen schneiden sich nie – ein Punkt genügt.
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
 * Wo die Stege einer inneren Form ansetzen: gleichmäßig über ihren Umfang
 * verteilt, jeweils etwa senkrecht von ihr weg (wie Speichen) zur
 * umschließenden Kontur, ohne eine andere Kontur zu kreuzen. Nimmt die schon
 * gesetzten Stege (`taken`) mit, damit keiner mit einem anderen zusammenläuft.
 * Liefert Strecken von innen nach außen.
 */
const placeBridges = (
  inner: Ring,
  outer: Ring,
  obstacles: Ring[],
  taken: Bridge[]
) => {
  const samples = resample(inner, BRIDGE_SAMPLE);
  if (samples.length < 3) return [];
  const count = Math.max(
    2,
    Math.min(4, Math.round(perimeter(inner) / BRIDGE_SPACING))
  );
  const blockers = [inner, ...obstacles];
  const maxTilt = Math.cos((BRIDGE_MAX_TILT * Math.PI) / 180);
  /** Kreuzt die Strecke eine Kontur? Etwas gekürzt, damit die Enden nicht zählen. */
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
    // Nach außen zeigende Senkrechte (Ringe laufen gegen den Uhrzeigersinn).
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
    // … oder zur nächsten Stelle, solange das nicht zu schräg ist.
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

  /** Zu nah an einem anderen Steg? Stege derselben Form dürfen nur nicht zusammenlaufen. */
  const crowded = (bridge: Bridge, others: Bridge[], own: Bridge[]) =>
    others.some(
      (other) =>
        segmentDistance(bridge.from, bridge.to, other.from, other.to) <
        BRIDGE_GAP
    ) ||
    own.some((other) => {
      const apart = Math.hypot(
        bridge.from[0] - other.from[0],
        bridge.from[1] - other.from[1]
      );
      return (
        segmentDistance(bridge.from, bridge.to, other.from, other.to) <
        0.9 * Math.min(BRIDGE_GAP, apart)
      );
    });

  // Umfang in `count` gleiche Abschnitte teilen und je Abschnitt den besten
  // Steg nehmen; den Versatz der Abschnitte so wählen, dass die Stege
  // insgesamt am kürzesten sind.
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
      // Kurz, aber möglichst mittig im Abschnitt und mit Abstand zu den
      // anderen – nur wenn es gar nicht anders geht, auch dicht daneben.
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

/**
 * Side profile of a bridge along its length: flat on the bed, on top an arch –
 * lowest in the middle, rising to the walls and meeting them vertically, so
 * the bridge runs into the wall without an edge. Every layer is smaller than
 * the one below: it prints without overhang; in use (upside down) it is an
 * arch over the dough. Beyond the contours (`extend`) it stays at full height.
 */
const bridgeProfile = (
  span: number,
  extend: number,
  endHeight: number,
  midHeight: number
): Ring => {
  const total = span + 2 * extend;
  const profile: Ring = [
    [0, 0],
    [total, 0],
    [total, endHeight],
  ];
  // Spaced by angle: densest at the walls where the arch is steep.
  const steps = 32;
  for (let i = steps; i >= 0; i--) {
    const phi = (i / steps) * Math.PI;
    profile.push([
      extend + (span * (1 - Math.cos(phi))) / 2,
      endHeight - (endHeight - midHeight) * Math.sin(phi),
    ]);
  }
  profile.push([0, endHeight]);
  return profile;
};

/**
 * Cross profile of a bridge (x = sideways, y = height): full height over the
 * band, beside it a concave quarter circle down to the bed – so the fillets
 * at the walls slope away from the bridge instead of standing as a block.
 */
const filletProfile = (half: number, radius: number, height: number): Ring => {
  const steps = 20;
  const right: Ring = [];
  for (let i = 0; i <= steps; i++) {
    // From the band edge (full height) out to the bed.
    const phi = (i / steps) * (Math.PI / 2);
    right.push([
      half + radius * Math.sin(phi),
      height * (1 - Math.sin(phi)) ** 2,
    ]);
  }
  const left = right.map(([x, y]): Point => [-x, y]).reverse();
  return [...left, ...right].reverse();
};

/** Abbildung der normierten Konturen (y nach unten) auf mm, zentriert, y nach oben. */
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
 * Baut aus den Konturen der Zeichnung den Ausstecher. Gedruckt wird Falz unten,
 * Schneide oben; die Kante zum Keks bleibt senkrecht, verjüngt wird nur auf der
 * anderen Seite.
 *
 * Das Innere eines Strichs wird gefüllt. Liegt eine eigene Form in einer
 * anderen, wird sie (mit `cutouts`) zur inneren Klinge, die ein Loch schneidet,
 * und über Stege auf Höhe der Falz mit der umschließenden Klinge verbunden.
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

    // Erst nach dem Schließen der Lücken die Löcher der Striche verwerfen: Ein
    // fast geschlossener Strich soll ein Ring werden, kein doppelter Ausstecher.
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
      // Löcher, in die keine Wand mehr passt, bleiben Keks.
      if (island.depth % 2 === 1) {
        const room = grow(
          track(new CrossSection([island.ring], "Positive")),
          -(wall + 0.6)
        );
        if (room.isEmpty()) return false;
      }
      return true;
    };
    // Eltern sind immer größer – nach Fläche absteigend ist die Reihenfolge richtig.
    const order = [...all.keys()].sort((a, b) => all[b].area - all[a].area);
    for (const i of order) if (keep(i)) kept.add(i);
    const islands = [...kept].map((i) => all[i]);
    if (islands.length === 0) return null;

    // Abwechselnd Keks und Loch: genau das ergibt „even-odd“.
    shape = track(
      track(
        new CrossSection(
          islands.map((island) => island.ring),
          "EvenOdd"
        )
      ).simplify(0.01)
    );
    if (shape.isEmpty()) return null;

    /** Wand der Dicke `thickness` um den Keks, von `z` bis `z + height`. */
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
    // Die Falz läuft außen herum – und um jede innere Form: um ein Loch auf
    // der Keksseite (im Gebrauch oben, über dem Teig), um Keks im Loch nach
    // außen ins Loch. So verbinden sich nahe Formen über die Falz miteinander
    // und mit dem Rand und stützen sich gegenseitig.
    if (params.flangeWidth > wall) {
      const pieces = islands.map((island) => {
        const area = track(new CrossSection([island.ring], "Positive"));
        if (island.depth === 0) {
          return track(grow(area, params.flangeWidth).subtract(area));
        }
        const parent = track(
          new CrossSection([all[island.parent].ring], "Positive")
        );
        // Ein Stück in die eigene Wand hinein, damit beides verschmilzt; nie
        // über die Falz der umschließenden Form hinaus.
        return island.depth % 2 === 1
          ? track(
              track(
                grow(area, params.flangeWidth).subtract(grow(area, -wall))
              ).intersect(grow(parent, params.flangeWidth))
            )
          : track(
              track(grow(area, params.flangeWidth).subtract(area)).intersect(
                parent
              )
            );
      });
      const flange = track(CrossSection.union(pieces));
      parts.push(track(flange.extrude(flangeHeight)));
    }

    // Bridges sit at the flange (on top in use, far from the dough; on the bed
    // when printing). Each one is a straight band under an arch: low in the
    // middle, rising to the walls and meeting them vertically. In plan its
    // corners at the walls are rounded off (by the real distance to the wall,
    // so also where it is oblique or curved), and these fillets slope down
    // away from the bridge like a fillet would – no edge where it joins.
    const maxEndHeight = Math.max(BRIDGE_MID_HEIGHT, top * BRIDGE_END_SHARE);
    const midHeight = Math.min(
      maxEndHeight,
      Math.max(BRIDGE_MID_HEIGHT, flangeHeight + 1)
    );
    // Long enough to reach through any wall, then cut to the wall faces.
    const extend = wall + 2;
    const soft = (section: CrossSection, delta: number) =>
      track(section.offset(delta, "Round", 2, 16));
    /** All walls in plan, below the taper where the bridges live. */
    const walls = track(grow(shape, wall).subtract(shape));
    /** A profile in the x/y plane, swept along a bridge and placed there. */
    const sweep = (
      profile: Ring,
      length: number,
      from: Point,
      dir: Point,
      along: boolean
    ) => {
      const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
      const prism = track(
        track(new CrossSection([profile], "NonZero")).extrude(length)
      );
      // `along`: x runs along the bridge, swept sideways; otherwise x runs
      // sideways, swept along. Stood up so y becomes the height.
      const placed = along
        ? track(
            track(
              track(prism.translate(0, 0, -length / 2)).rotate(90, 0, 0)
            ).rotate(0, 0, angle)
          )
        : track(track(prism.rotate(90, 0, 0)).rotate(0, 0, angle + 90));
      return track(placed.translate(from[0], from[1], 0));
    };
    const taken: Bridge[] = [];
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
      const placed = placeBridges(island.ring, parent.ring, obstacles, taken);
      taken.push(...placed);
      for (const { from, to } of placed) {
        const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (span <= 0) continue;
        const dir: Point = [(to[0] - from[0]) / span, (to[1] - from[1]) / span];
        const [nx, ny] = [-dir[1], dir[0]];
        const half = BRIDGE_WIDTH / 2;
        const [ax, ay] = [from[0] - dir[0] * extend, from[1] - dir[1] * extend];
        const [bx, by] = [to[0] + dir[0] * extend, to[1] + dir[1] * extend];
        const strip = track(
          track(
            new CrossSection(
              [
                [
                  [ax + nx * half, ay + ny * half],
                  [bx + nx * half, by + ny * half],
                  [bx - nx * half, by - ny * half],
                  [ax - nx * half, ay - ny * half],
                ],
              ],
              "NonZero"
            )
          ).intersect(allowed)
        );
        // Only the piece that really spans between the two contours: at a
        // notch the extension could poke into another bit of wall and stay
        // there as a loose block.
        const middle: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
        const pieces = strip.decompose();
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
          maxEndHeight,
          midHeight + span * BRIDGE_RISE_PER_MM
        );
        const reachOut = extend + 2 * BRIDGE_FILLET;
        const start: Point = [
          from[0] - dir[0] * reachOut,
          from[1] - dir[1] * reachOut,
        ];
        const length = span + 2 * reachOut;
        // Side view: the arch. Cross view: full height over the band, the
        // fillets beside it slope down to the bed.
        // The arch runs out vertically at the far faces of both walls: in
        // front of a curved wall only its steep flank shows, no plateau.
        const arch = sweep(
          bridgeProfile(span + 2 * wall, reachOut - wall, endHeight, midHeight),
          length,
          start,
          dir,
          true
        );
        const flanks = sweep(
          filletProfile(half, BRIDGE_FILLET, endHeight + 1),
          length,
          start,
          dir,
          false
        );
        const bar = track(
          track(
            track(footprint.extrude(endHeight + 1)).intersect(arch)
          ).intersect(flanks)
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

    return {
      manifold: Manifold.union(parts),
      outline: shape.toPolygons().map((ring) => ring.map(fromMm)),
    };
  } finally {
    for (const object of garbage) object.delete();
  }
};
