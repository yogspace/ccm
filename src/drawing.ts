import { type Point, type Ring, traceOutline } from "./geometry/outline";
import {
  type Drawing,
  hasEmboss,
  type Stroke,
  simplifyLine,
} from "./url-state";

/**
 * Helpers for the drawing as vectors (strokes + an area from an import):
 * painting, finding objects, moving and scaling, placing templates.
 */

/** Resolution of the drawing area (pixels per side). */
export const DRAW_RES = 1024;

/**
 * The pen's inks: what is drawn in black is cut out, what is drawn in the
 * embossing ink is pressed into the cookie (geometry/cutter.ts).
 */
export type Ink = "cut" | "emboss";

/** The embossing ink on the drawing area: pink, apart from black and the blue cut line. */
export const EMBOSS_INK = "#ff5fa8";

/** Grid on which touching is decided – fine enough for narrow eraser gaps. */
const GROUP_RES = 512;
/** From this opacity (0…255) on, a pixel counts as ink. */
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
 * Paints a drawing: first the area, then the strokes. As a polyline through the
 * points, simplified strokes (from links) stay close to the original too.
 * Each ink in its colour – or, with `layer`, only that ink, in black, to be
 * traced on its own (erasers take from both).
 */
export const paint = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  layer?: Ink
) => {
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (drawing.base.length > 0 && layer !== "emboss") {
    const path = ringsPath(drawing.base);
    if (drawing.baseLine === 0) ctx.fill(path, "evenodd");
    else {
      // Old links: a stroke along the inside of the contour instead of an area –
      // looks drawn, and the outer edge stays exactly the shared contour.
      ctx.save();
      ctx.clip(path);
      ctx.lineWidth = drawing.baseLine;
      ctx.stroke(path);
      ctx.restore();
    }
  }
  for (const { width, points, erase, emboss } of drawing.strokes) {
    const [first, ...rest] = points;
    if (!first) continue;
    if (!erase && layer && (layer === "emboss") !== Boolean(emboss)) continue;
    const ink = emboss && !layer ? EMBOSS_INK : "#000";
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    // Erasers punch out whatever is painted up to then.
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

/** One ink of a drawing, painted on a canvas of its own and traced. */
export const traceLayer = (drawing: Drawing, layer: Ink): Ring[] => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DRAW_RES;
  const ctx = canvas.getContext("2d");
  try {
    if (!ctx) throw new Error("No canvas");
    paint(ctx, drawing, layer);
    return traceOutline(canvas);
  } finally {
    // Freed right away: iOS Safari's canvas memory is tight and freed late.
    canvas.width = canvas.height = 0;
  }
};

/** What is cut and what is embossed – each ink traced on its own. */
export const traceInks = (drawing: Drawing) => ({
  rings: traceLayer(drawing, "cut"),
  emboss: hasEmboss(drawing) ? traceLayer(drawing, "emboss") : [],
});

/** Selected parts: strokes and contours of the imported area (indices each). */
export type Selection = { strokes: number[]; rings: number[] };

export type Box = { x0: number; y0: number; x1: number; y1: number };

const isEmpty = (selection: Selection) =>
  selection.strokes.length === 0 && selection.rings.length === 0;

/** Both together, without duplicates – e.g. a selection plus a shift-click. */
export const mergeSelections = (a: Selection, b: Selection): Selection => ({
  strokes: [...new Set([...a.strokes, ...b.strokes])].sort((x, y) => x - y),
  rings: [...new Set([...a.rings, ...b.rings])].sort((x, y) => x - y),
});

/** Box around the selection in drawing-area pixels, including stroke width. */
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
    // Erasers only take away – they do not count towards the box.
    if (!stroke || stroke.erase) continue;
    for (const [x, y] of stroke.points) add(x, y, stroke.width / 2);
  }
  for (const index of selection.rings) {
    for (const [x, y] of drawing.base[index] ?? []) {
      add(x * DRAW_RES, y * DRAW_RES, 0);
    }
  }
  return Number.isFinite(box.x0) ? box : null;
};

/** Rotate (rad) and scale around (cx, cy), then move by (dx, dy) – in pixels. */
export type Transform = {
  scale: number;
  angle?: number;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
};

/** The transform as a mapping of a point. */
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

/** Applies the transform to the selection; stroke widths scale along. */
export const transformDrawing = (
  drawing: Drawing,
  selection: Selection,
  transform: Transform
): Drawing => {
  const { scale } = transform;
  const apply = applyTransform(transform);
  const chosen = new Set(selection.strokes);
  const rings = new Set(selection.rings);
  // The line width of old links applies to the whole area – only scale it when
  // all of it is selected.
  const wholeBase =
    drawing.base.length > 0 && rings.size === drawing.base.length;
  return {
    base: drawing.base.map((ring, index) =>
      rings.has(index)
        ? ring.map(([x, y]): Point => {
            const [px, py] = apply([x * DRAW_RES, y * DRAW_RES]);
            return [px / DRAW_RES, py / DRAW_RES];
          })
        : ring
    ),
    baseLine: wholeBase ? drawing.baseLine * scale : drawing.baseLine,
    strokes: drawing.strokes.map((stroke, index) =>
      chosen.has(index)
        ? {
            // Keep everything (also “erase”), only position and width change.
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

/** Points at most `step` pixels apart – so long straight lines can be split. */
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
 * Erasing really takes away: strokes are shortened or split where the eraser
 * touches them – far enough that the round ends of the remaining pieces also
 * stop at the eraser's edge. What is gone entirely disappears from the drawing.
 * An imported area is traced again with the eraser applied. The eraser itself
 * stays nowhere – otherwise it would be an invisible hole.
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
    // A point stays only if its round cap does not reach the eraser either.
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
  if (!baseBox || !boxesOverlap(baseBox, reachBox)) {
    return { ...drawing, strokes };
  }
  // The imported area is traced again with the eraser: what is gone is gone,
  // and pieces cut apart become contours of their own.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DRAW_RES;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ...drawing, strokes };
  paint(ctx, {
    base: drawing.base,
    baseLine: drawing.baseLine,
    strokes: [{ ...eraser, erase: true }],
  });
  return {
    base: traceOutline(canvas)
      .map((ring) => simplifyLine(ring, 0.0008))
      .filter((ring) => ring.length >= 3),
    baseLine: 0,
    strokes,
  };
};

/** Sets the width of the selected strokes (erasers stay as they are). */
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

/** Puts the selected strokes into an ink (erasers stay as they are). */
export const setStrokeInk = (
  drawing: Drawing,
  selection: Selection,
  ink: Ink
): Drawing => {
  const chosen = new Set(selection.strokes);
  return {
    ...drawing,
    strokes: drawing.strokes.map((stroke, index) => {
      if (!chosen.has(index) || stroke.erase) return stroke;
      const { emboss: _, ...plain } = stroke;
      return ink === "emboss" ? { ...plain, emboss: true } : plain;
    }),
  };
};

/** Ink of the selection (of its first stroke), otherwise `null`. */
export const selectionInk = (
  drawing: Drawing,
  selection: Selection
): Ink | null => {
  const stroke = selection.strokes
    .map((index) => drawing.strokes[index])
    .find((candidate) => candidate && !candidate.erase);
  return stroke ? (stroke.emboss ? "emboss" : "cut") : null;
};

/** Stroke width of the selection (of its first stroke), otherwise `null`. */
export const selectionWidth = (drawing: Drawing, selection: Selection) => {
  const stroke = selection.strokes
    .map((index) => drawing.strokes[index])
    .find((candidate) => candidate && !candidate.erase);
  return stroke ? stroke.width : null;
};

/** Removes the selection from the drawing. */
export const removeSelection = (
  drawing: Drawing,
  selection: Selection
): Drawing => {
  const chosen = new Set(selection.strokes);
  const rings = new Set(selection.rings);
  const base = drawing.base.filter((_, index) => !rings.has(index));
  return {
    base,
    baseLine: base.length > 0 ? drawing.baseLine : 0,
    strokes: drawing.strokes.filter((_, index) => !chosen.has(index)),
  };
};

/**
 * Splits the drawing into objects: what touches belongs together. For that it
 * is rasterised small; connected ink is one object, and strokes running
 * through the same ink end up in the same one.
 */
const objectCache = new WeakMap<Drawing, ReturnType<typeof scanObjects>>();

/** Objects of a drawing – rasterised only once per drawing (it is immutable). */
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

  // Label connected ink (8-neighbourhood).
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

  /** Nearest ink around a point (drawing-area pixels) within `radius` (grid). */
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

  // Join the parts of an element (thin strokes fall apart on the coarse grid).
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
  // Every contour of the imported area on its own – so separate parts of an
  // import can be grabbed one by one (holes stay with their ink).
  const ringLabels = drawing.base.map((ring) =>
    labelOf(ring.map(([x, y]): Point => [x * DRAW_RES, y * DRAW_RES]))
  );

  // An eraser belongs to every object whose ink it runs along – without joining
  // them: erasing straight through an object leaves two.
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

  /** Everything that belongs to one of the roots – including their erasers. */
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
    rings: ringLabels.flatMap((label, index) =>
      label && roots.has(find(label)) ? [index] : []
    ),
  });

  /** Roots of the selected ink (without erasers). */
  const rootsOf = (selection: Selection) => {
    const roots = new Set<number>();
    for (const index of selection.strokes) {
      const label = strokeLabels[index];
      if (label) roots.add(find(label));
    }
    for (const index of selection.rings) {
      const label = ringLabels[index];
      if (label) roots.add(find(label));
    }
    return roots;
  };

  /** Ink box per object (grid), computed only when needed. */
  let rootBoxes: Map<number, Box> | null = null;
  /** Roots of all objects whose ink lies entirely in the rectangle (drawing-area pixels). */
  const rootsWithin = (area: Box) => {
    if (!rootBoxes) {
      rootBoxes = new Map();
      for (let cell = 0; cell < labels.length; cell++) {
        if (!labels[cell]) continue;
        const root = find(labels[cell]);
        const x = cell % GROUP_RES;
        const y = (cell - x) / GROUP_RES;
        const known = rootBoxes.get(root);
        if (!known) rootBoxes.set(root, { x0: x, y0: y, x1: x, y1: y });
        else {
          known.x0 = Math.min(known.x0, x);
          known.y0 = Math.min(known.y0, y);
          known.x1 = Math.max(known.x1, x);
          known.y1 = Math.max(known.y1, y);
        }
      }
    }
    const roots = new Set<number>();
    for (const [root, cells] of rootBoxes) {
      // Centres of the grid cells in drawing-area pixels
      if (
        (cells.x0 + 0.5) / toGrid >= area.x0 &&
        (cells.y0 + 0.5) / toGrid >= area.y0 &&
        (cells.x1 + 0.5) / toGrid <= area.x1 &&
        (cells.y1 + 0.5) / toGrid <= area.y1
      ) {
        roots.add(root);
      }
    }
    return roots;
  };

  return { labelNear, find, collect, rootsOf, rootsWithin, eraserRoots };
};

/** The object under a point (drawing-area pixels), otherwise `null`. */
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

/** All objects lying entirely in the rectangle (drawing-area pixels) – box selection. */
export const objectsWithin = (
  drawing: Drawing,
  area: Box
): Selection | null => {
  const objects = findObjects(drawing);
  if (!objects) return null;
  const roots = objects.rootsWithin(area);
  if (roots.size === 0) return null;
  const selection = objects.collect(roots);
  return isEmpty(selection) ? null : selection;
};

/**
 * Before moving or deleting: an eraser that also touches other objects is
 * duplicated – one stays for the others, one goes with the selection. The copy
 * sits right after the original, so at the same place in the painting order.
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
        selection: { strokes: picked, rings: selection.rings },
      }
    : { drawing, selection };
};

/**
 * A template's contours (normalised 0…1) as closed strokes in an ink: centred
 * on `center`, the longer side `size` pixels.
 */
export const presetStrokes = (
  rings: Ring[],
  [cx, cy]: Point,
  size: number,
  width: number,
  ink: Ink = "cut"
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
    return {
      width,
      points: simplifyLine(closed, 0.8),
      ...(ink === "emboss" && { emboss: true }),
    };
  });
};
