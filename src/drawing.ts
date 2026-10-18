import { ANCHOR, lineStroke, mapAnchors, nearestOnPath } from "./bezier";
import { type Point, type Ring, traceOutline } from "./geometry/outline";
import {
  type Drawing,
  hasEmboss,
  type Stroke,
  simplifyLine,
  withAreaInks,
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
 * Each ink in its color – or, with `layer`, only that ink, in black, to be
 * traced on its own (erasers take from both).
 */
export const paint = (
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  layer?: Ink
) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The area, its contours in each ink apart (a contour and its holes always
  // share one).
  for (const emboss of [false, true]) {
    if (layer && (layer === "emboss") !== emboss) continue;
    const rings = drawing.base.filter(
      (_, i) => (drawing.baseEmboss?.[i] === true) === emboss
    );
    if (rings.length === 0) continue;
    const ink = emboss && !layer ? EMBOSS_INK : "#000";
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    const path = ringsPath(rings);
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

/**
 * A change of place, x' = a·x + c·y + e, y' = b·x + d·y + f – as
 * [a, b, c, d, e, f] (draw/frame.ts builds them).
 */
type Mapping = readonly [number, number, number, number, number, number];

/**
 * The selection moved, turned or sized – lines keep their width, like Figma
 * without “scale strokes”: an outline made bigger stays as thin as it was
 * drawn. An anchored line's anchors move, and its points follow from them:
 * it stays an anchored line.
 */
export const transformBy = (
  drawing: Drawing,
  selection: Selection,
  m: Mapping
): Drawing => {
  const map = ([x, y]: Point): Point => [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5],
  ];
  const chosen = new Set(selection.strokes);
  const rings = new Set(selection.rings);
  return {
    ...drawing,
    base: drawing.base.map((ring, index) =>
      rings.has(index)
        ? ring.map(([x, y]): Point => {
            const [px, py] = map([x * DRAW_RES, y * DRAW_RES]);
            return [px / DRAW_RES, py / DRAW_RES];
          })
        : ring
    ),
    strokes: drawing.strokes.map((stroke, index) => {
      if (!chosen.has(index)) return stroke;
      if (stroke.anchors) {
        return lineStroke(
          { width: stroke.width, emboss: stroke.emboss },
          mapAnchors(stroke.anchors, map),
          stroke.closed
        );
      }
      // Keep everything (also “erase”), only the places change.
      return { ...stroke, points: stroke.points.map(map) };
    }),
  };
};

/**
 * The selection's points, flat pairs (drawing-area pixels) – what must stay
 * on the area: a line's points, of an anchored line its anchors too (its
 * handles may reach beyond, bezier.ts), the area's contours.
 */
export const pointsOf = (drawing: Drawing, selection: Selection) => {
  const out: number[] = [];
  for (const index of selection.strokes) {
    const stroke = drawing.strokes[index];
    if (!stroke || stroke.erase) continue;
    for (const [x, y] of stroke.points) out.push(x, y);
    const a = stroke.anchors ?? [];
    for (let k = 0; k + 1 < a.length; k += ANCHOR) out.push(a[k], a[k + 1]);
  }
  for (const index of selection.rings) {
    for (const [x, y] of drawing.base[index] ?? []) {
      out.push(x * DRAW_RES, y * DRAW_RES);
    }
  }
  return out;
};

/** Everything in the drawing, selected. */
export const everything = (drawing: Drawing): Selection => ({
  strokes: drawing.strokes.map((_, i) => i),
  rings: drawing.base.map((_, i) => i),
});

export const isNothing = isEmpty;

export const sameSelection = (a: Selection, b: Selection) =>
  a.strokes.join() === b.strokes.join() && a.rings.join() === b.rings.join();

/** Whether `a` holds all of `b`. */
export const holds = (a: Selection, b: Selection) =>
  b.strokes.every((i) => a.strokes.includes(i)) &&
  b.rings.every((i) => a.rings.includes(i));

/** `b` taken out of `a` if `a` holds all of it – else put in (⇧-click). */
export const toggleSelection = (a: Selection, b: Selection): Selection =>
  holds(a, b)
    ? {
        strokes: a.strokes.filter((i) => !b.strokes.includes(i)),
        rings: a.rings.filter((i) => !b.rings.includes(i)),
      }
    : mergeSelections(a, b);

/** The selection's strokes and contours on their own – to copy. */
export const pickDrawing = (
  drawing: Drawing,
  selection: Selection
): Drawing => {
  const rings = selection.rings.filter((i) => drawing.base[i]);
  return withAreaInks(
    {
      base: rings.map((i) => drawing.base[i]),
      baseLine: drawing.baseLine,
      strokes: selection.strokes.flatMap((i) => drawing.strokes[i] ?? []),
    },
    rings.map((i) => drawing.baseEmboss?.[i] === true)
  );
};

/**
 * Copies laid on top of the drawing, moved by (dx, dy) as far as the area
 * allows, and selected – null for nothing to copy. `within`: the move kept
 * on the area (draw/gestures.ts `moveWithin`).
 */
export const addCopies = (
  drawing: Drawing,
  copies: Drawing,
  dx: number,
  dy: number,
  within: (points: readonly number[], dx: number, dy: number) => Point
): { drawing: Drawing; selection: Selection } | null => {
  const all = everything(copies);
  if (isEmpty(all)) return null;
  const [mx, my] = within(pointsOf(copies, all), dx, dy);
  const moved = transformBy(copies, all, [1, 0, 0, 1, mx, my]);
  const baseLine = drawing.base.length > 0 ? drawing.baseLine : moved.baseLine;
  return {
    drawing: withAreaInks(
      {
        base: [...drawing.base, ...moved.base],
        baseLine,
        strokes: [...drawing.strokes, ...moved.strokes],
      },
      [
        ...drawing.base.map((_, i) => drawing.baseEmboss?.[i] === true),
        ...moved.base.map((_, i) => moved.baseEmboss?.[i] === true),
      ]
    ),
    selection: {
      strokes: moved.strokes.map((_, i) => drawing.strokes.length + i),
      rings: moved.base.map((_, i) => drawing.base.length + i),
    },
  };
};

/**
 * The anchored line (bezier.ts) at a point (drawing-area pixels) – its
 * stroke reaching `tolerance` further – the topmost; otherwise `null`.
 */
export const anchoredAt = (
  drawing: Drawing,
  [x, y]: Point,
  tolerance: number
) => {
  for (let index = drawing.strokes.length - 1; index >= 0; index--) {
    const { anchors, closed, erase, width } = drawing.strokes[index];
    if (!anchors || erase) continue;
    const { d } = nearestOnPath(anchors, Boolean(closed), x, y);
    if (d <= width / 2 + tolerance) return index;
  }
  return null;
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
    // Ordinary strokes – an anchored line cut is none any more (its anchors
    // go), as in vector programs.
    const { anchors: _anchors, closed: _closed, ...plain } = stroke;
    const flush = () => {
      if (run.length > 0) {
        strokes.push({ ...plain, points: simplifyLine(run, 0.5) });
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
  // The imported area is traced again with the eraser, each ink on its own:
  // what is gone is gone, and pieces cut apart become contours of their own.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DRAW_RES;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ...drawing, strokes };
  const retrace = (emboss: boolean) => {
    const base = drawing.base.filter(
      (_, i) => (drawing.baseEmboss?.[i] === true) === emboss
    );
    if (base.length === 0) return [];
    ctx.clearRect(0, 0, DRAW_RES, DRAW_RES);
    paint(ctx, {
      base,
      baseLine: drawing.baseLine,
      strokes: [{ ...eraser, erase: true }],
    });
    return traceOutline(canvas)
      .map((ring) => simplifyLine(ring, 0.0008))
      .filter((ring) => ring.length >= 3);
  };
  const cut = retrace(false);
  const pink = retrace(true);
  return withAreaInks({ base: [...cut, ...pink], baseLine: 0, strokes }, [
    ...cut.map(() => false),
    ...pink.map(() => true),
  ]);
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

/**
 * Puts the selected strokes and contours of the imported area into an ink
 * (erasers stay as they are).
 */
export const setStrokeInk = (
  drawing: Drawing,
  selection: Selection,
  ink: Ink
): Drawing => {
  const chosen = new Set(selection.strokes);
  const rings = new Set(selection.rings);
  return withAreaInks(
    {
      ...drawing,
      strokes: drawing.strokes.map((stroke, index) => {
        if (!chosen.has(index) || stroke.erase) return stroke;
        const { emboss: _, ...plain } = stroke;
        return ink === "emboss" ? { ...plain, emboss: true } : plain;
      }),
    },
    drawing.base.map((_, index) =>
      rings.has(index) ? ink === "emboss" : drawing.baseEmboss?.[index] === true
    )
  );
};

/** Ink of the selection (of its first stroke or contour), otherwise `null`. */
export const selectionInk = (
  drawing: Drawing,
  selection: Selection
): Ink | null => {
  const stroke = selection.strokes
    .map((index) => drawing.strokes[index])
    .find((candidate) => candidate && !candidate.erase);
  if (stroke) return stroke.emboss ? "emboss" : "cut";
  const [ring] = selection.rings;
  if (ring === undefined) return null;
  return drawing.baseEmboss?.[ring] ? "emboss" : "cut";
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
  return withAreaInks(
    {
      base,
      baseLine: base.length > 0 ? drawing.baseLine : 0,
      strokes: drawing.strokes.filter((_, index) => !chosen.has(index)),
    },
    drawing.base.flatMap((_, index) =>
      rings.has(index) ? [] : [drawing.baseEmboss?.[index] === true]
    )
  );
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

  /** Roots of every object with ink in the rectangle (drawing-area pixels). */
  const rootsIn = (area: Box) => {
    const roots = new Set<number>();
    const x0 = Math.max(0, Math.floor(area.x0 * toGrid));
    const y0 = Math.max(0, Math.floor(area.y0 * toGrid));
    const x1 = Math.min(GROUP_RES - 1, Math.ceil(area.x1 * toGrid));
    const y1 = Math.min(GROUP_RES - 1, Math.ceil(area.y1 * toGrid));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const label = labels[y * GROUP_RES + x];
        if (label) roots.add(find(label));
      }
    }
    return roots;
  };

  /** Every object's root. */
  const allRoots = () => {
    const roots = new Set<number>();
    for (let label = 1; label <= count; label++) roots.add(find(label));
    return roots;
  };

  return {
    labelNear,
    find,
    collect,
    rootsOf,
    rootsIn,
    allRoots,
    eraserRoots,
  };
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

/**
 * Every object a dragged box touches (drawing-area pixels), whole – like
 * Figma, touching is enough – or `null`.
 */
export const objectsTouching = (
  drawing: Drawing,
  area: Box
): Selection | null => {
  const objects = findObjects(drawing);
  if (!objects) return null;
  const roots = objects.rootsIn(area);
  if (roots.size === 0) return null;
  const selection = objects.collect(roots);
  return isEmpty(selection) ? null : selection;
};

/** The boxes of the objects the selection is no part of – each one's. */
export const otherBoxes = (drawing: Drawing, selection: Selection): Box[] => {
  const objects = findObjects(drawing);
  if (!objects) return [];
  const mine = objects.rootsOf(selection);
  const boxes: Box[] = [];
  for (const root of objects.allRoots()) {
    if (mine.has(root)) continue;
    const box = selectionBox(drawing, objects.collect(new Set([root])));
    if (box) boxes.push(box);
  }
  return boxes;
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
