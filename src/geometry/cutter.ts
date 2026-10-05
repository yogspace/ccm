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
/** Teile unter diesem Anteil der Gesamtfläche gelten als Krümel. */
const MIN_ISLAND_SHARE = 0.01;
/** Stege zwischen inneren und äußeren Klingen (mm): mittig so breit … */
const BRIDGE_MID_WIDTH = 3;
/** … und zu den Wänden hin um höchstens so viel breiter. */
const BRIDGE_MAX_FLARE = 4;
/** Höhe in der Mitte des Stegs; an den Wänden wird er höher (siehe bridgeProfile). */
const BRIDGE_MID_HEIGHT = 3;
/** Anteil der Gesamthöhe, bis zu dem der Steg an den Wänden höchstens hochgeht. */
const BRIDGE_END_SHARE = 0.45;
/**
 * Wie stark die Enden ausgestellt sind, wächst mit der Spannweite – kurze Stege
 * bleiben schlank statt zum Klotz zu werden.
 */
const BRIDGE_RISE_PER_MM = 0.25;
const BRIDGE_FLARE_PER_MM = 0.2;
/** Etwa ein Steg je so viel mm Umfang der inneren Form, mindestens zwei. */
const BRIDGE_SPACING = 45;
/** Abstand der Stellen, an denen ein Steg ansetzen darf (mm). */
const BRIDGE_SAMPLE = 1.5;
/** Wie viel mm Steglänge ein mm näher an der Mitte seines Abschnitts wert ist. */
const BRIDGE_SPREAD = 0.6;

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

/**
 * Wo die Stege einer inneren Form ansetzen: gleichmäßig über ihren Umfang
 * verteilt, jeweils auf kürzestem Weg zur umschließenden Kontur, ohne eine
 * andere Kontur zu kreuzen. Liefert Strecken von innen nach außen.
 */
const placeBridges = (inner: Ring, outer: Ring, obstacles: Ring[]) => {
  const samples = resample(inner, BRIDGE_SAMPLE);
  if (samples.length === 0) return [];
  const count = Math.max(
    2,
    Math.min(4, Math.round(perimeter(inner) / BRIDGE_SPACING))
  );
  const rings = [inner, outer, ...obstacles];
  const candidates = samples.map((from) => {
    const to = closestOnRing(from, outer);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // Etwas gekürzt prüfen, damit die Endpunkte auf den Konturen nicht zählen.
    const ux = (to[0] - from[0]) / (length || 1);
    const uy = (to[1] - from[1]) / (length || 1);
    const a: Point = [from[0] + ux * 0.05, from[1] + uy * 0.05];
    const b: Point = [to[0] - ux * 0.05, to[1] - uy * 0.05];
    const free = rings.every((ring) =>
      ring.every(
        (point, i) => !segmentsCross(a, b, point, ring[(i + 1) % ring.length])
      )
    );
    return { from, to, length, free };
  });

  // Umfang in `count` gleiche Abschnitte teilen und je Abschnitt den besten
  // freien Steg nehmen; den Versatz der Abschnitte so wählen, dass die Stege
  // insgesamt am kürzesten sind.
  let best: typeof candidates = [];
  let bestScore = Infinity;
  const tries = 12;
  for (let offset = 0; offset < tries; offset++) {
    const picked: typeof candidates = [];
    let score = 0;
    for (let part = 0; part < count; part++) {
      const start = Math.floor(
        ((part + offset / tries) / count) * samples.length
      );
      const end = Math.floor(
        ((part + 1 + offset / tries) / count) * samples.length
      );
      // Kurz, aber möglichst mittig im Abschnitt – sonst rutschen die Stege
      // an der engsten Stelle zusammen und verschmelzen.
      const middle = (start + end) / 2;
      let choice: (typeof candidates)[number] | undefined;
      let choiceCost = Infinity;
      for (let k = start; k < end; k++) {
        const candidate = candidates[k % samples.length];
        const cost =
          candidate.length +
          BRIDGE_SPREAD * Math.abs(k - middle) * BRIDGE_SAMPLE;
        if (candidate.free && cost < choiceCost) {
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
 * Profil eines Stegs entlang seiner Länge: flach auf dem Bett, oben zwischen
 * den Wänden durchhängend wie das Seil einer Hängebrücke – an den Wänden hoch
 * und kräftig angesetzt, in der Mitte niedriger. Jede Schicht ist kleiner als
 * die darunter, gedruckt wird also ohne Überhang; im Gebrauch (umgedreht) ist
 * es ein Bogen über dem Teig.
 */
const bridgeProfile = (
  span: number,
  extend: number,
  endHeight: number,
  midHeight: number
): Ring => {
  const total = span + 2 * extend;
  const steps = 24;
  const profile: Ring = [
    [0, 0],
    [total, 0],
  ];
  for (let i = steps; i >= 0; i--) {
    const u = (i / steps) * total;
    const t = span > 0 ? (u - extend) / span : 0;
    const height =
      t <= 0 || t >= 1
        ? endHeight
        : midHeight + (endHeight - midHeight) * (2 * t - 1) ** 2;
    profile.push([u, height]);
  }
  return profile;
};

/**
 * Grundriss eines Stegs: zu den Wänden hin breiter wie die Pfeiler einer
 * Hängebrücke, damit er großflächig in die Wand greift.
 */
const bridgeFootprint = (
  span: number,
  extend: number,
  endWidth: number
): Ring => {
  const total = span + 2 * extend;
  const steps = 24;
  const half = (u: number) => {
    const t = span > 0 ? (u - extend) / span : 0;
    const width =
      t <= 0 || t >= 1
        ? endWidth
        : BRIDGE_MID_WIDTH + (endWidth - BRIDGE_MID_WIDTH) * (2 * t - 1) ** 2;
    return width / 2;
  };
  const top: Ring = [];
  const bottom: Ring = [];
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * total;
    top.push([u, half(u)]);
    bottom.push([u, -half(u)]);
  }
  return [...bottom, ...top.reverse()];
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
      if (island.area < minArea) return false;
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
    const outer = track(
      new CrossSection(
        islands
          .filter((island) => island.depth === 0)
          .map((island) => island.ring),
        "Positive"
      )
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
    // Die Falz läuft nur außen herum; innere Klingen hängen an Stegen.
    if (params.flangeWidth > wall) {
      const flange = track(grow(outer, params.flangeWidth).subtract(outer));
      parts.push(track(flange.extrude(flangeHeight)));
    }

    // Stege: an der Falz (im Gebrauch oben, weit weg vom Teig), beim Druck auf
    // dem Bett. Sie reichen in beide Wände hinein und nie über die Außenwand.
    const maxEndHeight = Math.max(BRIDGE_MID_HEIGHT, top * BRIDGE_END_SHARE);
    const midHeight = Math.min(
      maxEndHeight,
      Math.max(BRIDGE_MID_HEIGHT, flangeHeight + 1)
    );
    // Großzügig verlängert und dann exakt an den Wandflächen abgeschnitten:
    // Der Steg geht durch die ganze Wand, ragt aber nirgends heraus.
    const extend = wall + 2;
    for (const [index, island] of islands.entries()) {
      if (island.depth === 0) continue;
      const parent = all[island.parent];
      const obstacles = islands
        .filter((_, other) => other !== index && islands[other] !== parent)
        .map((other) => other.ring);
      // Wo der Steg sein darf: zwischen den beiden Konturen samt ihren Wänden.
      // Bei einem Loch wächst dessen Wand nach innen, die äußere nach außen;
      // bei Keks im Loch liegen beide Wände im Loch.
      const parentArea = track(new CrossSection([parent.ring], "Positive"));
      const childArea = track(new CrossSection([island.ring], "Positive"));
      const allowed = track(
        track(
          island.depth % 2 === 1
            ? grow(parentArea, wall).subtract(grow(childArea, -wall))
            : parentArea.subtract(childArea)
        ).extrude(maxEndHeight + 1)
      );
      // Kleine innere Formen bekommen schmalere Stegenden.
      const { min, max } = childArea.bounds();
      const childSize = Math.min(max[0] - min[0], max[1] - min[1]);
      for (const { from, to } of placeBridges(
        island.ring,
        parent.ring,
        obstacles
      )) {
        const span = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const endHeight = Math.min(
          maxEndHeight,
          midHeight + span * BRIDGE_RISE_PER_MM
        );
        const endWidth =
          BRIDGE_MID_WIDTH +
          Math.min(
            BRIDGE_MAX_FLARE,
            span * BRIDGE_FLARE_PER_MM,
            childSize * 0.25
          );
        const angle =
          (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
        const ux = (to[0] - from[0]) / (span || 1);
        const uy = (to[1] - from[1]) / (span || 1);
        // Seitenprofil (x = Länge, y = Höhe) in voller Breite extrudieren und
        // aufstellen, mit dem ausgestellten Grundriss schneiden, dann in
        // Stegrichtung drehen und an den Anfang (samt Überstand) schieben.
        const side = track(
          track(
            track(
              track(
                new CrossSection(
                  [bridgeProfile(span, extend, endHeight, midHeight)],
                  "NonZero"
                )
              ).extrude(endWidth)
            ).translate(0, 0, -endWidth / 2)
          ).rotate(90, 0, 0)
        );
        const plan = track(
          track(
            new CrossSection(
              [bridgeFootprint(span, extend, endWidth)],
              "NonZero"
            )
          ).extrude(endHeight)
        );
        const bar = track(
          track(
            track(track(side.intersect(plan)).rotate(0, 0, angle)).translate(
              from[0] - ux * extend,
              from[1] - uy * extend,
              0
            )
          ).intersect(allowed)
        );
        // Nur das zusammenhängende Hauptstück: An Einbuchtungen kann die
        // Verlängerung sonst über eine Lücke in ein anderes Wandstück reichen
        // und dort als loser Klotz stehen bleiben.
        const pieces = bar.decompose();
        garbage.push(...pieces);
        const main = pieces.reduce<Manifold | null>(
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
