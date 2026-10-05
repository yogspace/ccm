import type { Point, Ring } from "./geometry/outline";
import { type Drawing, type Stroke, simplifyLine } from "./url-state";

/**
 * Helfer für die Zeichnung als Vektoren (Striche + Fläche aus einem Import):
 * malen, Objekte finden, verschieben und skalieren, Vorlagen platzieren.
 */

/** Auflösung der Zeichenfläche (Pixel je Seite). */
export const DRAW_RES = 1024;

/** Raster, auf dem bestimmt wird, was sich berührt. */
const GROUP_RES = 256;
/** Ab dieser Deckkraft (0…255) zählt ein Pixel als Tinte. */
const INK = 40;

const ringsPath = (rings: Ring[]) => {
  const path = new Path2D();
  for (const ring of rings) {
    for (const [i, [x, y]] of ring.entries()) {
      if (i === 0) path.moveTo(x * DRAW_RES, y * DRAW_RES);
      else path.lineTo(x * DRAW_RES, y * DRAW_RES);
    }
    path.closePath();
  }
  return path;
};

/**
 * Malt eine Zeichnung: erst die Fläche, dann die Striche. Als Linienzug durch
 * die Punkte bleiben auch vereinfachte Striche (aus Links) nah am Original.
 */
export const paint = (ctx: CanvasRenderingContext2D, drawing: Drawing) => {
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (drawing.base.length > 0) {
    const path = ringsPath(drawing.base);
    if (drawing.baseLine === 0) ctx.fill(path, "evenodd");
    else {
      // Alte Links: als Strich innen entlang der Kontur statt als Fläche – sieht
      // aus wie gezeichnet, und die Außenkante bleibt exakt die geteilte Kontur.
      ctx.save();
      ctx.clip(path);
      ctx.lineWidth = drawing.baseLine;
      ctx.stroke(path);
      ctx.restore();
    }
  }
  for (const { width, points, erase } of drawing.strokes) {
    const [first, ...rest] = points;
    if (!first) continue;
    // Radierer stanzen aus, was bis dahin gemalt ist.
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.arc(first[0], first[1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    if (rest.length === 0) continue;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (const [x, y] of rest) ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
};

/** Ausgewählte Teile: Striche (Indizes) und/oder die Fläche aus einem Import. */
export type Selection = { strokes: number[]; base: boolean };

export type Box = { x0: number; y0: number; x1: number; y1: number };

const isEmpty = (selection: Selection) =>
  selection.strokes.length === 0 && !selection.base;

/** Rahmen um die Auswahl in Zeichenflächen-Pixeln, samt Strichbreite. */
export const selectionBox = (
  drawing: Drawing,
  selection: Selection
): Box | null => {
  let box: Box = {
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity,
  };
  const add = (x: number, y: number, pad: number) => {
    box = {
      x0: Math.min(box.x0, x - pad),
      y0: Math.min(box.y0, y - pad),
      x1: Math.max(box.x1, x + pad),
      y1: Math.max(box.y1, y + pad),
    };
  };
  for (const index of selection.strokes) {
    const stroke = drawing.strokes[index];
    // Radierer nehmen nur weg – sie zählen nicht zum Rahmen.
    if (!stroke || stroke.erase) continue;
    for (const [x, y] of stroke.points) add(x, y, stroke.width / 2);
  }
  if (selection.base) {
    for (const ring of drawing.base) {
      for (const [x, y] of ring) add(x * DRAW_RES, y * DRAW_RES, 0);
    }
  }
  return Number.isFinite(box.x0) ? box : null;
};

/** Drehen (rad) und skalieren um (cx, cy), dann verschieben um (dx, dy) – in Pixeln. */
export type Transform = {
  scale: number;
  angle?: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
};

/** Die Transformation als Abbildung eines Punkts. */
export const applyTransform = ({
  scale,
  angle = 0,
  cx,
  cy,
  dx,
  dy,
}: Transform) => {
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return ([x, y]: Point): Point => [
    cx + (x - cx) * cos - (y - cy) * sin + dx,
    cy + (x - cx) * sin + (y - cy) * cos + dy,
  ];
};

/** Wendet die Transformation auf die Auswahl an; Strichbreiten skalieren mit. */
export const transformDrawing = (
  drawing: Drawing,
  selection: Selection,
  transform: Transform
): Drawing => {
  const { scale } = transform;
  const apply = applyTransform(transform);
  const chosen = new Set(selection.strokes);
  return {
    base: selection.base
      ? drawing.base.map((ring) =>
          ring.map(([x, y]) => {
            const [px, py] = apply([x * DRAW_RES, y * DRAW_RES]);
            return [px / DRAW_RES, py / DRAW_RES];
          })
        )
      : drawing.base,
    baseLine: selection.base ? drawing.baseLine * scale : drawing.baseLine,
    strokes: drawing.strokes.map((stroke, index) =>
      chosen.has(index)
        ? {
            // Alles übernehmen (auch „Radierer“), nur Lage und Breite ändern sich.
            ...stroke,
            width: Math.max(1, stroke.width * scale),
            points: stroke.points.map(apply),
          }
        : stroke
    ),
  };
};

const distanceToSegment = (
  [px, py]: Point,
  [ax, ay]: Point,
  [bx, by]: Point
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t =
    length > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
      : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

const distanceToPath = (point: Point, path: Point[]) => {
  if (path.length === 1) return distanceToSegment(point, path[0], path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    best = Math.min(best, distanceToSegment(point, path[i - 1], path[i]));
  }
  return best;
};

/** Punkte höchstens `step` Pixel auseinander – damit lange Geraden sich teilen lassen. */
const densify = (points: Point[], step: number) => {
  const dense: Point[] = points.length > 0 ? [points[0]] : [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= parts; k++) {
      dense.push([ax + ((bx - ax) * k) / parts, ay + ((by - ay) * k) / parts]);
    }
  }
  return dense;
};

const pathBox = (points: Point[], pad: number): Box => {
  let box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of points) {
    box = {
      x0: Math.min(box.x0, x - pad),
      y0: Math.min(box.y0, y - pad),
      x1: Math.max(box.x1, x + pad),
      y1: Math.max(box.y1, y + pad),
    };
  }
  return box;
};

const boxesOverlap = (a: Box, b: Box) =>
  a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/**
 * Radieren wirklich wegnehmen: Striche werden dort gekürzt bzw. geteilt, wo der
 * Radierer sie berührt – so weit, dass auch die runden Enden der Reststücke an
 * der Radierkante aufhören. Was ganz weg ist, verschwindet aus der Zeichnung.
 * Der Radierer selbst bleibt nur für eine importierte Fläche stehen (die lässt
 * sich nicht kürzen) – bei Strichen bliebe er sonst als unsichtbares Loch zurück.
 */
export const applyEraser = (drawing: Drawing, eraser: Stroke): Drawing => {
  const radius = eraser.width / 2;
  const reachBox = pathBox(eraser.points, radius);
  const strokes: Stroke[] = [];
  for (const stroke of drawing.strokes) {
    const half = stroke.width / 2;
    if (stroke.erase || !boxesOverlap(pathBox(stroke.points, half), reachBox)) {
      strokes.push(stroke);
      continue;
    }
    const dense = densify(stroke.points, 2);
    // Ein Punkt bleibt nur, wenn auch seine runde Kappe den Radierer nicht erreicht.
    const keep = dense.map(
      (point) => distanceToPath(point, eraser.points) > radius + half
    );
    if (keep.every(Boolean)) {
      strokes.push(stroke);
      continue;
    }
    let run: Point[] = [];
    const flush = () => {
      if (run.length > 0) {
        strokes.push({ ...stroke, points: simplifyLine(run, 0.5) });
      }
      run = [];
    };
    dense.forEach((point, i) => {
      if (keep[i]) run.push(point);
      else flush();
    });
    flush();
  }
  const baseBox =
    drawing.base.length > 0
      ? pathBox(
          drawing.base.flatMap((ring) =>
            ring.map(([x, y]): Point => [x * DRAW_RES, y * DRAW_RES])
          ),
          0
        )
      : null;
  const cutsBase = baseBox !== null && boxesOverlap(baseBox, reachBox);
  return {
    ...drawing,
    strokes: cutsBase ? [...strokes, { ...eraser, erase: true }] : strokes,
  };
};

/** Setzt die Strichstärke der ausgewählten Striche (Radierer bleiben, wie sie sind). */
export const setStrokeWidth = (
  drawing: Drawing,
  selection: Selection,
  width: number
): Drawing => {
  const chosen = new Set(selection.strokes);
  return {
    ...drawing,
    strokes: drawing.strokes.map((stroke, index) =>
      chosen.has(index) && !stroke.erase ? { ...stroke, width } : stroke
    ),
  };
};

/** Strichstärke der Auswahl (des ersten Strichs), sonst `null`. */
export const selectionWidth = (drawing: Drawing, selection: Selection) => {
  const stroke = selection.strokes
    .map((index) => drawing.strokes[index])
    .find((candidate) => candidate && !candidate.erase);
  return stroke ? stroke.width : null;
};

/** Entfernt die Auswahl aus der Zeichnung. */
export const removeSelection = (
  drawing: Drawing,
  selection: Selection
): Drawing => {
  const chosen = new Set(selection.strokes);
  return {
    base: selection.base ? [] : drawing.base,
    baseLine: selection.base ? 0 : drawing.baseLine,
    strokes: drawing.strokes.filter((_, index) => !chosen.has(index)),
  };
};

/**
 * Zerlegt die Zeichnung in Objekte: Was sich berührt, gehört zusammen. Dafür
 * wird sie klein gerastert; zusammenhängende Tinte ist ein Objekt, und Striche,
 * die durch dieselbe Tinte laufen, landen im selben.
 */
const objectCache = new WeakMap<Drawing, ReturnType<typeof scanObjects>>();

/** Objekte einer Zeichnung – je Zeichnung nur einmal gerastert (sie ist unveränderlich). */
const findObjects = (drawing: Drawing) => {
  let objects = objectCache.get(drawing);
  if (!objects) {
    objects = scanObjects(drawing);
    objectCache.set(drawing, objects);
  }
  return objects;
};

const scanObjects = (drawing: Drawing) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GROUP_RES;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const toGrid = GROUP_RES / DRAW_RES;
  ctx.scale(toGrid, toGrid);
  paint(ctx, drawing);
  const { data } = ctx.getImageData(0, 0, GROUP_RES, GROUP_RES);

  // Zusammenhängende Tinte markieren (8er-Nachbarschaft).
  const labels = new Int32Array(GROUP_RES * GROUP_RES);
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] < INK) continue;
    count++;
    labels[start] = count;
    stack.push(start);
    while (stack.length > 0) {
      const cell = stack.pop() as number;
      const x = cell % GROUP_RES;
      const y = (cell - x) / GROUP_RES;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx < 0 || ny < 0 || nx >= GROUP_RES || ny >= GROUP_RES) continue;
          const next = ny * GROUP_RES + nx;
          if (labels[next] || data[next * 4 + 3] < INK) continue;
          labels[next] = count;
          stack.push(next);
        }
      }
    }
  }

  const parent = Array.from({ length: count + 1 }, (_, i) => i);
  const find = (label: number) => {
    let root = label;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };

  /** Nächste Tinte um einen Punkt (Zeichenflächen-Pixel) im Umkreis `radius` (Raster). */
  const labelNear = ([px, py]: Point, radius: number) => {
    const gx = Math.round(px * toGrid);
    const gy = Math.round(py * toGrid);
    for (let r = 0; r <= radius; r++) {
      for (let y = gy - r; y <= gy + r; y++) {
        for (let x = gx - r; x <= gx + r; x++) {
          if (x < 0 || y < 0 || x >= GROUP_RES || y >= GROUP_RES) continue;
          const label = labels[y * GROUP_RES + x];
          if (label) return label;
        }
      }
    }
    return 0;
  };

  // Teile eines Elements verbinden (dünne Striche zerfallen im groben Raster).
  const labelOf = (points: Point[]) => {
    let first = 0;
    for (let i = 0; i < points.length; i += 3) {
      const label = labelNear(points[i], 2);
      if (!label) continue;
      if (!first) first = label;
      else parent[find(label)] = find(first);
    }
    return first;
  };
  const strokeLabels = drawing.strokes.map((stroke) =>
    stroke.erase ? 0 : labelOf(stroke.points)
  );
  const baseLabel = labelOf(
    drawing.base.flatMap((ring) =>
      ring.map(([x, y]): Point => [x * DRAW_RES, y * DRAW_RES])
    )
  );

  // Ein Radierer gehört zu allen Objekten, an deren Tinte er entlangfährt –
  // ohne sie zu verbinden: Wer ein Objekt durchradiert, bekommt zwei.
  const eraserRoots = drawing.strokes.map((stroke) => {
    const roots = new Set<number>();
    if (!stroke.erase) return roots;
    const reach = Math.ceil((stroke.width / 2) * toGrid) + 2;
    for (let i = 0; i < stroke.points.length; i += 3) {
      const gx = Math.round(stroke.points[i][0] * toGrid);
      const gy = Math.round(stroke.points[i][1] * toGrid);
      for (let y = gy - reach; y <= gy + reach; y++) {
        for (let x = gx - reach; x <= gx + reach; x++) {
          if (x < 0 || y < 0 || x >= GROUP_RES || y >= GROUP_RES) continue;
          const label = labels[y * GROUP_RES + x];
          if (label) roots.add(find(label));
        }
      }
    }
    return roots;
  });

  /** Alles, was zu einer der Wurzeln gehört – samt der Radierer daran. */
  const collect = (roots: Set<number>): Selection => ({
    strokes: drawing.strokes.flatMap((stroke, index) => {
      if (stroke.erase) {
        return [...eraserRoots[index]].some((root) => roots.has(root))
          ? [index]
          : [];
      }
      const label = strokeLabels[index];
      return label && roots.has(find(label)) ? [index] : [];
    }),
    base: baseLabel > 0 && roots.has(find(baseLabel)),
  });

  /** Wurzeln der ausgewählten Tinte (ohne Radierer). */
  const rootsOf = (selection: Selection) => {
    const roots = new Set<number>();
    for (const index of selection.strokes) {
      const label = strokeLabels[index];
      if (label) roots.add(find(label));
    }
    if (selection.base && baseLabel) roots.add(find(baseLabel));
    return roots;
  };

  return { labelNear, find, collect, rootsOf, eraserRoots };
};

/** Das Objekt unter einem Punkt (Zeichenflächen-Pixel), sonst `null`. */
export const objectAt = (
  drawing: Drawing,
  point: Point,
  tolerance: number
): Selection | null => {
  const objects = findObjects(drawing);
  if (!objects) return null;
  const hit = objects.labelNear(
    point,
    Math.ceil((tolerance * GROUP_RES) / DRAW_RES)
  );
  if (!hit) return null;
  const selection = objects.collect(new Set([objects.find(hit)]));
  return isEmpty(selection) ? null : selection;
};

/** Erweitert eine Auswahl um alles, was sie berührt (z. B. nach dem Verschieben). */
export const objectOf = (drawing: Drawing, selection: Selection): Selection => {
  const objects = findObjects(drawing);
  if (!objects) return selection;
  const roots = objects.rootsOf(selection);
  return roots.size > 0 ? objects.collect(roots) : selection;
};

/**
 * Vor dem Verschieben oder Löschen: Ein Radierer, der auch andere Objekte
 * berührt, wird verdoppelt – einer bleibt für die anderen, einer geht mit der
 * Auswahl. Die Kopie steht direkt hinter dem Original, also an derselben Stelle
 * in der Malreihenfolge.
 */
export const detachErasers = (
  drawing: Drawing,
  selection: Selection
): { drawing: Drawing; selection: Selection } => {
  const objects = findObjects(drawing);
  if (!objects) return { drawing, selection };
  const roots = objects.rootsOf(selection);
  const chosen = new Set(selection.strokes);
  const strokes: Stroke[] = [];
  const picked: number[] = [];
  let copied = false;
  drawing.strokes.forEach((stroke, index) => {
    strokes.push(stroke);
    if (!chosen.has(index)) return;
    const shared =
      stroke.erase &&
      [...objects.eraserRoots[index]].some((root) => !roots.has(root));
    if (shared) {
      strokes.push({ ...stroke });
      copied = true;
    }
    picked.push(strokes.length - 1);
  });
  return copied
    ? {
        drawing: { ...drawing, strokes },
        selection: { strokes: picked, base: selection.base },
      }
    : { drawing, selection };
};

/**
 * Konturen einer Vorlage (normiert 0…1) als geschlossene Striche: zentriert
 * auf `center`, die längere Seite `size` Pixel groß.
 */
export const presetStrokes = (
  rings: Ring[],
  [cx, cy]: Point,
  size: number,
  width: number
): Stroke[] => {
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
  const scale = size / Math.max(maxX - minX, maxY - minY, 1e-6);
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  return rings.map((ring) => {
    const points = ring.map(
      ([x, y]): Point => [cx + (x - mx) * scale, cy + (y - my) * scale]
    );
    const closed = [...points, points[0]];
    return { width, points: simplifyLine(closed, 0.8) };
  });
};
