import { FileUp, Redo2, Trash2, Undo2, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type CSSProperties,
  type DragEvent,
  memo,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import {
  applyEraser,
  applyTransform,
  type Box,
  DRAW_RES,
  detachErasers,
  objectAt,
  paint,
  presetStrokes,
  removeSelection,
  type Selection,
  selectionBox,
  selectionWidth,
  setStrokeWidth,
  type Transform,
  transformDrawing,
} from "../drawing";
import { loadSilhouette, type Point, traceOutline } from "../geometry/outline";
import {
  fallbackName,
  loadPreset,
  type Preset,
  type PresetShape,
  presets,
} from "../presets";
import {
  drawingChanged,
  importFailed,
  initial,
  store,
  type Tool,
  useMmPerCanvas,
} from "../store";
import {
  type Drawing,
  emptyDrawing,
  isEmptyDrawing,
  type Stroke,
} from "../url-state";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import CookieSlider from "./cookie-slider";
import DrawGrid from "./draw-grid";
import ToolPicker from "./tool-picker";

type Pen = { x: number; y: number };

type Snapshot = { image: ImageData; drawing: Drawing };

/** Eine laufende Verschiebe-Geste; transformiert wird immer ab `start`. */
type Gesture = {
  /** `scale` an den Ecken dreht und skaliert zugleich. */
  kind: "drag" | "scale" | "pinch";
  start: Drawing;
  selection: Selection;
  box: Box;
  origin: Point;
  pinch?: { distance: number; mid: Point; angle: number };
  before: Snapshot;
  changed: boolean;
};

const RES = DRAW_RES;
/** Anteil, um den der Strich pro Sample zur echten Stiftposition aufholt. */
const FOLLOW = 0.35;
const HISTORY = 40;
/** Rand um importierte SVGs, damit sie nicht an der Kante kleben. */
const IMPORT_MARGIN = 0.1;
/** So nah (CSS-Pixel) muss man ein Objekt oder einen Anfasser treffen. */
const HIT = 12;
/** Kleinste Größe (Pixel der Zeichenfläche), auf die man ein Objekt skalieren kann. */
const MIN_SIZE = 16;
/** Mit Umschalttaste rastet die Drehung in diesen Schritten ein … */
const ROTATE_STEP = Math.PI / 12;
/** … sonst nur nahe 0°, 90°, 180°, 270°, damit Gerades gerade bleibt. */
const ROTATE_MAGNET = (4 * Math.PI) / 180;

/** Rahmen der Auswahl: Mitte, Größe, Drehung – in Pixeln der Zeichenfläche. */
type Frame = { cx: number; cy: number; w: number; h: number; angle: number };

/** Rahmen eines Kastens, optional so transformiert wie das Objekt darin. */
const frameOf = (box: Box, transform?: Transform): Frame => {
  const middle: Point = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
  const [cx, cy] = transform ? applyTransform(transform)(middle) : middle;
  const scale = transform?.scale ?? 1;
  return {
    cx,
    cy,
    w: (box.x1 - box.x0) * scale,
    h: (box.y1 - box.y0) * scale,
    angle: transform?.angle ?? 0,
  };
};

const snapAngle = (angle: number, steps: boolean) => {
  if (steps) return Math.round(angle / ROTATE_STEP) * ROTATE_STEP;
  const right = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  return Math.abs(angle - right) < ROTATE_MAGNET ? right : angle;
};

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const middle = (a: Point, b: Point): Point => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];
const center = (box: Box): Point => [
  (box.x0 + box.x1) / 2,
  (box.y0 + box.y1) / 2,
];
const angleOf = (from: Point, to: Point) =>
  Math.atan2(to[1] - from[1], to[0] - from[0]);
const inside = (box: Box, [x, y]: Point, reach: number) =>
  x >= box.x0 - reach &&
  x <= box.x1 + reach &&
  y >= box.y0 - reach &&
  y <= box.y1 + reach;
const corners = (box: Box): Point[] => [
  [box.x0, box.y0],
  [box.x1, box.y0],
  [box.x1, box.y1],
  [box.x0, box.y1],
];

/** Skalierung so begrenzen, dass das Objekt weder verschwindet noch explodiert. */
const clampScale = (box: Box, scale: number) => {
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
  return Math.min(Math.max(scale, MIN_SIZE / size), (RES * 1.5) / size);
};

/**
 * Zeichenfläche mit Werkzeugen und Vorlagen. Werkzeug, Pinselstärke, Einheit
 * und die fertige Kontur kommen aus dem Store, jede Änderung der Zeichnung geht
 * dorthin zurück. Gesten, Auswahl und Rückgängig bleiben hier lokal.
 */
const DrawCanvas = () => {
  const { t } = useTranslation();
  const { tool, brush, unit, cutter } = useSnapshot(store);
  const { outline } = cutter;
  const mmPerCanvas = useMmPerCanvas();
  const presetNames = t("presets", { returnObjects: true }) as Record<
    string,
    string
  >;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const brushCursorRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pen = useRef<{ smoothed: Pen; mid: Pen; points: Point[] } | null>(null);
  /** Was gemalt wurde, als Vektoren – das wird geteilt und verschoben. */
  const drawing = useRef<Drawing>(initial.drawing);
  const history = useRef<Snapshot[]>([]);
  /** Rückgängig Gemachtes, für Wiederholen – jede neue Aktion leert es. */
  const future = useRef<Snapshot[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const wheel = useRef<{ before: Snapshot; timer: number } | null>(null);
  const widthEdit = useRef<{ before: Snapshot; timer: number } | null>(null);
  const mode = tool === "move" ? "move" : "draw";
  const [selection, setSelection] = useState<Selection | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  /** Während einer Geste: der mitgedrehte Rahmen (sonst folgt er `box`). */
  const [gestureFrame, setGestureFrame] = useState<Frame | null>(null);
  const [shapes, setShapes] = useState<Record<string, PresetShape>>({});
  const [empty, setEmpty] = useState(isEmptyDrawing(initial.drawing));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Der Hinweis verschwindet schon beim Ansetzen des Stifts, nicht erst danach.
  const [penDown, setPenDown] = useState(false);
  // Für Listener außerhalb von React (Mausrad, Tastatur): immer der neueste Stand.
  const live = useRef({ mode, selection, box });
  live.current = { mode, selection, box };

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setEmpty(isEmptyDrawing(drawing.current));
    drawingChanged(canvas, drawing.current);
  };

  const capture = (): Snapshot | null => {
    const ctx = context();
    return ctx
      ? { image: ctx.getImageData(0, 0, RES, RES), drawing: drawing.current }
      : null;
  };

  const remember = (entry: Snapshot | null) => {
    if (!entry) return;
    history.current.push(entry);
    if (history.current.length > HISTORY) history.current.shift();
    setCanUndo(true);
    future.current = [];
    setCanRedo(false);
  };

  /** Stellt einen gespeicherten Stand wieder her. */
  const restore = (state: Snapshot) => {
    const ctx = context();
    if (!ctx) return;
    ctx.putImageData(state.image, 0, 0);
    drawing.current = state.drawing;
    select(null);
    commit();
  };

  const snapshot = () => remember(capture());

  /** Malt die ganze Zeichnung neu aus den Vektoren. */
  const repaint = () => {
    const ctx = context();
    if (!ctx) return;
    ctx.clearRect(0, 0, RES, RES);
    paint(ctx, drawing.current);
  };

  const select = (next: Selection | null) => {
    setSelection(next);
    const nextBox = next ? selectionBox(drawing.current, next) : null;
    setBox(nextBox);
    live.current = { ...live.current, selection: next, box: nextBox };
    // Der Regler zeigt die Strichstärke der Auswahl (und ändert sie).
    const width = next ? selectionWidth(drawing.current, next) : null;
    if (width) store.brush = Math.round(Math.min(64, Math.max(6, width)));
  };

  /** Pinselstärke; mit Auswahl im Verschiebe-Modus auch deren Striche. */
  const changeBrush = (value: number) => {
    store.brush = value;
    const { mode: current, selection: chosen } = live.current;
    if (current !== "move" || !chosen) return;
    const before = widthEdit.current?.before ?? capture();
    if (!before) return;
    if (widthEdit.current) window.clearTimeout(widthEdit.current.timer);
    drawing.current = setStrokeWidth(drawing.current, chosen, value);
    repaint();
    const nextBox = selectionBox(drawing.current, chosen);
    setBox(nextBox);
    live.current = { ...live.current, box: nextBox };
    // Eine Reglerbewegung = ein Schritt fürs Rückgängig, dann neu berechnen.
    const timer = window.setTimeout(() => {
      widthEdit.current = null;
      remember(before);
      commit();
    }, 300);
    widthEdit.current = { before, timer };
  };

  const undo = () => {
    const current = capture();
    const previous = history.current.pop();
    if (!current || !previous) return;
    future.current.push(current);
    setCanUndo(history.current.length > 0);
    setCanRedo(true);
    restore(previous);
  };

  const redo = () => {
    const current = capture();
    const next = future.current.pop();
    if (!current || !next) return;
    history.current.push(current);
    if (history.current.length > HISTORY) history.current.shift();
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
    restore(next);
  };

  const clear = () => {
    const ctx = context();
    if (!ctx) return;
    snapshot();
    ctx.clearRect(0, 0, RES, RES);
    drawing.current = emptyDrawing;
    select(null);
    commit();
  };

  const removeSelected = () => {
    const current = live.current.selection;
    if (!current) return;
    snapshot();
    // Geteilte Radierer bleiben für die anderen Objekte erhalten.
    const detached = detachErasers(drawing.current, current);
    drawing.current = removeSelection(detached.drawing, detached.selection);
    repaint();
    select(null);
    commit();
  };

  const importFile = async (file: File) => {
    const ctx = context();
    if (!ctx) return;
    try {
      const silhouette = await loadSilhouette(file, RES);
      const inner = RES * (1 - 2 * IMPORT_MARGIN);
      const scale = inner / Math.max(silhouette.width, silhouette.height);
      const w = silhouette.width * scale;
      const h = silhouette.height * scale;
      snapshot();
      ctx.clearRect(0, 0, RES, RES);
      ctx.drawImage(silhouette, (RES - w) / 2, (RES - h) / 2, w, h);
      // Geteilt wird die Silhouette als Fläche, nicht das SVG selbst.
      const canvas = canvasRef.current;
      drawing.current = {
        base: canvas ? traceOutline(canvas) : [],
        baseLine: 0,
        strokes: [],
      };
      select(null);
      commit();
    } catch (error) {
      importFailed(error);
    }
  };

  /**
   * Fügt eine Vorlage als Umriss in Pinselstärke ein – groß auf leerer Fläche,
   * sonst kleiner in der Mitte (z. B. als Loch in einer Form) – und wählt sie
   * zum Verschieben aus.
   */
  const insertPreset = async (preset: Preset) => {
    try {
      const shape = await loadPreset(preset);
      const size = (isEmptyDrawing(drawing.current) ? 0.6 : 0.24) * RES;
      const strokes = presetStrokes(
        shape.rings,
        [RES / 2, RES / 2],
        size,
        brush
      );
      if (strokes.length === 0) return;
      snapshot();
      const first = drawing.current.strokes.length;
      drawing.current = {
        ...drawing.current,
        strokes: [...drawing.current.strokes, ...strokes],
      };
      repaint();
      commit();
      store.tool = "move";
      // Nur die Vorlage – sie verschmilzt erst, wenn man sie loslässt und neu wählt.
      select({ strokes: strokes.map((_, i) => first + i), rings: [] });
    } catch (error) {
      importFailed(error);
    }
  };

  const chooseTool = (next: Tool) => {
    store.tool = next;
    select(null);
    hideBrush();
  };
  // Stabil für die memoisierte Werkzeugauswahl, ruft aber immer die aktuelle Fassung.
  const chooseToolRef = useRef(chooseTool);
  chooseToolRef.current = chooseTool;
  const onChooseTool = useCallback(
    (next: Tool) => chooseToolRef.current(next),
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Start
  useEffect(() => {
    const ctx = context();
    if (!ctx || isEmptyDrawing(initial.drawing)) return;
    paint(ctx, initial.drawing);
    if (initial.trace) commit();
  }, []);

  // Die Zeichenfläche ist das größte Quadrat, das neben bzw. über den Leisten
  // Platz hat. Was die Leisten brauchen (Raster minus Fläche), wird gemessen
  // statt geschätzt – je nach Platz stehen sie daneben oder brechen darunter um.
  // Beide Maße werden jedes Mal frisch gelesen: Der Observer meldet Raster und
  // Fläche nicht immer zusammen, alte Werte ließen die Größe hin- und
  // herspringen. Berechnete Maße statt getBoundingClientRect, damit
  // Transforms (Fläche beim Drop) nicht mitzählen.
  useEffect(() => {
    const area = areaRef.current;
    const grid = gridRef.current;
    const stage = stageRef.current;
    if (!area || !grid || !stage) return;
    const observer = new ResizeObserver(() => {
      const outer = getComputedStyle(grid);
      const inner = getComputedStyle(stage);
      const chrome = (key: "width" | "height") =>
        `${(Number.parseFloat(outer[key]) - Number.parseFloat(inner[key])).toFixed(2)}px`;
      area.style.setProperty("--chrome-w", chrome("width"));
      area.style.setProperty("--chrome-h", chrome("height"));
    });
    observer.observe(grid);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Umrisse der Vorlagen für ihre Karten laden.
  useEffect(() => {
    let cancelled = false;
    for (const preset of presets) {
      loadPreset(preset).then(
        (shape) => {
          if (!cancelled) {
            setShapes((current) => ({ ...current, [preset.id]: shape }));
          }
        },
        (error) => console.error(error)
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // ⌘/Strg+Z rückgängig, mit Umschalt (oder Strg+Y) wiederholen.
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) redo();
        else undo();
        return;
      }
      // Im Dateinamen-Feld u. Ä. gehören die Tasten dem Feld.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (live.current.mode !== "move" || !live.current.selection) return;
      if (event.key === "Escape") select(null);
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Mausrad skaliert die Auswahl; React hängt Wheel-Listener passiv an, daher
  // direkt am Element, damit die Seite dabei nicht scrollt.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const { mode: current, selection: chosen, box: frame } = live.current;
      if (current !== "move" || !chosen || !frame) return;
      event.preventDefault();
      const before = wheel.current?.before ?? capture();
      if (!before) return;
      if (wheel.current) window.clearTimeout(wheel.current.timer);
      const [cx, cy] = center(frame);
      const scale = clampScale(frame, Math.exp(-event.deltaY * 0.0015));
      drawing.current = transformDrawing(drawing.current, chosen, {
        scale,
        cx,
        cy,
        dx: 0,
        dy: 0,
      });
      repaint();
      const nextBox = selectionBox(drawing.current, chosen);
      setBox(nextBox);
      live.current = { ...live.current, box: nextBox };
      // Erst wenn das Rad ruht: ein Schritt fürs Rückgängig, dann neu berechnen.
      const timer = window.setTimeout(() => {
        wheel.current = null;
        remember(before);
        commit();
        select(chosen);
      }, 300);
      wheel.current = { before, timer };
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  const toCanvas = (
    { clientX, clientY }: { clientX: number; clientY: number },
    rect: DOMRect
  ): Pen => ({
    x: ((clientX - rect.left) / rect.width) * RES,
    y: ((clientY - rect.top) / rect.height) * RES,
  });

  const toPoint = (
    event: { clientX: number; clientY: number },
    rect: DOMRect
  ): Point => {
    const { x, y } = toCanvas(event, rect);
    return [x, y];
  };

  // ---------- Malen ----------

  const draw = (path: (ctx: CanvasRenderingContext2D) => void) => {
    const ctx = context();
    if (!ctx) return;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    snapshot();
    setPenDown(true);
    const point = toCanvas(event, event.currentTarget.getBoundingClientRect());
    pen.current = { smoothed: point, mid: point, points: [[point.x, point.y]] };
    // Ein Tipp ohne Bewegung ergibt einen Punkt. Als Kreis gefüllt, weil Safari
    // Linien der Länge null mit runden Enden nicht zeichnet.
    const ctx = context();
    if (!ctx) return;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(point.x, point.y, brush / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = pen.current;
    if (!state) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length > 0 ? samples : [event]) {
      const raw = toCanvas(sample, rect);
      // Stiftposition nachziehen lassen, damit Zittern verschwindet …
      const previous = state.smoothed;
      const smoothed = {
        x: previous.x + (raw.x - previous.x) * FOLLOW,
        y: previous.y + (raw.y - previous.y) * FOLLOW,
      };
      // … und zwischen den Mittelpunkten als Kurve statt als Gerade zeichnen.
      const mid = {
        x: (previous.x + smoothed.x) / 2,
        y: (previous.y + smoothed.y) / 2,
      };
      const from = state.mid;
      draw((ctx) => {
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
      });
      state.smoothed = smoothed;
      state.mid = mid;
      state.points.push([smoothed.x, smoothed.y]);
    }
  };

  const end = () => {
    const state = pen.current;
    if (!state) return;
    setPenDown(false);
    draw((ctx) => {
      ctx.moveTo(state.mid.x, state.mid.y);
      ctx.lineTo(state.smoothed.x, state.smoothed.y);
    });
    pen.current = null;
    const stroke: Stroke = { width: brush, points: state.points };
    if (tool === "eraser") {
      // Radiertes wirklich entfernen und aus dem Modell neu malen.
      drawing.current = applyEraser(drawing.current, stroke);
      repaint();
    } else {
      drawing.current = {
        ...drawing.current,
        strokes: [...drawing.current.strokes, stroke],
      };
    }
    commit();
  };

  // ---------- Verschieben & Skalieren ----------

  const tolerance = (rect: DOMRect) => (HIT * RES) / rect.width;

  const grab = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toPoint(event, rect);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;

    // Zweiter Finger: Zwei-Finger-Geste skaliert, dreht und verschiebt.
    if (current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        ...current,
        kind: "pinch",
        start: drawing.current,
        box: selectionBox(drawing.current, current.selection) ?? current.box,
        pinch: {
          distance: Math.max(distance(a, b), 1),
          mid: middle(a, b),
          angle: angleOf(a, b),
        },
      };
      return;
    }
    if (pointers.current.size > 1) return;

    const reach = tolerance(rect);
    const before = capture();
    if (!before) return;
    if (selection && box) {
      const start = {
        start: drawing.current,
        selection,
        box,
        origin: point,
        before,
        changed: false,
      };
      // Ecken drehen und skalieren, innen verschieben – die Auswahl bleibt
      // dabei, wie sie ist (auch wenn sie etwas berührt).
      if (corners(box).some((corner) => distance(corner, point) <= reach)) {
        gesture.current = { kind: "scale", ...start };
        return;
      }
      if (inside(box, point, 0)) {
        gesture.current = { kind: "drag", ...start };
        return;
      }
    }
    const found = objectAt(drawing.current, point, reach);
    // Radierer, die auch andere Objekte betreffen, werden für dieses verdoppelt.
    const detached = found ? detachErasers(drawing.current, found) : null;
    if (detached) drawing.current = detached.drawing;
    const hit = detached?.selection ?? null;
    select(hit);
    const hitBox = hit ? selectionBox(drawing.current, hit) : null;
    if (hit && hitBox) {
      gesture.current = {
        kind: "drag",
        start: drawing.current,
        selection: hit,
        box: hitBox,
        origin: point,
        before,
        changed: false,
      };
    }
  };

  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const point = toPoint(event, rect);
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, point);
    }
    const current = gesture.current;

    // Ohne Geste nur den Zeiger anpassen: Anfasser, Ecke, Objekt oder nichts.
    if (!current) {
      const reach = tolerance(rect);
      const corner = box
        ? corners(box).findIndex((c) => distance(c, point) <= reach)
        : -1;
      canvas.style.cursor =
        corner >= 0
          ? corner % 2 === 0
            ? "nwse-resize"
            : "nesw-resize"
          : (box && inside(box, point, 0)) ||
              objectAt(drawing.current, point, reach)
            ? "grab"
            : "default";
      return;
    }

    let transform: Transform;
    if (current.kind === "pinch" && current.pinch) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const mid = middle(a, b);
      transform = {
        scale: clampScale(current.box, distance(a, b) / current.pinch.distance),
        angle: angleOf(a, b) - current.pinch.angle,
        cx: current.pinch.mid[0],
        cy: current.pinch.mid[1],
        dx: mid[0] - current.pinch.mid[0],
        dy: mid[1] - current.pinch.mid[1],
      };
    } else if (current.kind === "scale") {
      const middle = center(current.box);
      const from = Math.max(distance(current.origin, middle), 1);
      transform = {
        scale: clampScale(current.box, distance(point, middle) / from),
        angle: snapAngle(
          angleOf(middle, point) - angleOf(middle, current.origin),
          event.shiftKey
        ),
        cx: middle[0],
        cy: middle[1],
        dx: 0,
        dy: 0,
      };
    } else {
      canvas.style.cursor = "grabbing";
      transform = {
        scale: 1,
        cx: 0,
        cy: 0,
        dx: point[0] - current.origin[0],
        dy: point[1] - current.origin[1],
      };
    }
    drawing.current = transformDrawing(
      current.start,
      current.selection,
      transform
    );
    current.changed = true;
    repaint();
    setGestureFrame(frameOf(current.box, transform));
  };

  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (!current) return;
    // Ein Finger bleibt liegen: von hier aus weiter verschieben.
    if (current.kind === "pinch" && pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      gesture.current = {
        ...current,
        kind: "drag",
        start: drawing.current,
        box: selectionBox(drawing.current, current.selection) ?? current.box,
        origin: rest,
      };
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = null;
    setGestureFrame(null);
    event.currentTarget.style.cursor = "grab";
    if (!current.changed) return;
    remember(current.before);
    commit();
    // Die Auswahl bleibt für weitere Korrekturen; was sich jetzt berührt,
    // gehört beim nächsten Antippen zusammen.
    select(current.selection);
  };

  // ---------- Pinselvorschau ----------

  const hideBrush = () => {
    if (brushCursorRef.current) brushCursorRef.current.style.opacity = "0";
  };

  const showBrush = (event: PointerEvent<HTMLDivElement>) => {
    const cursor = brushCursorRef.current;
    const stage = stageRef.current;
    if (!cursor || !stage) return;
    // Nur mit Maus oder Stift – auf Touch gibt es kein Hover.
    if (mode !== "draw" || event.pointerType === "touch") {
      hideBrush();
      return;
    }
    const rect = stage.getBoundingClientRect();
    const size = (brush * rect.width) / RES;
    cursor.style.width = cursor.style.height = `${size}px`;
    cursor.style.transform = `translate(${event.clientX - rect.left - size / 2}px, ${event.clientY - rect.top - size / 2}px)`;
    cursor.style.opacity = "1";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) importFile(file);
  };

  const frame = gestureFrame ?? (box ? frameOf(box) : null);

  const presetName = (preset: Preset) =>
    presetNames[preset.id] ?? fallbackName(preset.id);

  return (
    <div className="draw-area" ref={areaRef}>
      {/* Ein Raster für Fläche und Leisten: Ist Platz daneben, stehen die
          Werkzeuge links und die Vorlagen rechts, sonst alles darunter (CSS). */}
      <div className="draw-grid" ref={gridRef}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: reine Drop-Fläche, Import geht auch über den Button */}
        <div
          className="stage paper"
          data-dragging={dragging || undefined}
          data-mode={mode}
          data-tool={tool}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={onDrop}
          onPointerLeave={hideBrush}
          onPointerMove={showBrush}
          ref={stageRef}
        >
          <DrawGrid mmPerCanvas={mmPerCanvas} unit={unit} />
          <canvas
            className="drawing"
            height={RES}
            onPointerCancel={mode === "draw" ? end : release}
            onPointerDown={mode === "draw" ? start : grab}
            onPointerMove={mode === "draw" ? move : drag}
            onPointerUp={mode === "draw" ? end : release}
            ref={canvasRef}
            width={RES}
          />
          {outline.length > 0 && (
            <svg
              aria-hidden
              className="outline"
              preserveAspectRatio="none"
              viewBox="0 0 1 1"
            >
              <path
                d={outline
                  .map(
                    (ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`
                  )
                  .join("")}
              />
            </svg>
          )}
          {mode === "move" && frame && (
            <div
              aria-hidden
              className="selection"
              style={{
                left: `${((frame.cx - frame.w / 2) / RES) * 100}%`,
                top: `${((frame.cy - frame.h / 2) / RES) * 100}%`,
                width: `${(frame.w / RES) * 100}%`,
                height: `${(frame.h / RES) * 100}%`,
                rotate: `${frame.angle}rad`,
              }}
            >
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {/* X an der Auswahl: entfernt sie (wie Entf) */}
          {mode === "move" && box && !gestureFrame && (
            <Button
              aria-label={t("draw.removeSelection")}
              className="icon remove-chip"
              onClick={removeSelected}
              style={{
                left: `clamp(1.2rem, calc(${(box.x1 / RES) * 100}% + 14px), calc(100% - 1.2rem))`,
                top: `clamp(1.2rem, calc(${(box.y0 / RES) * 100}% - 14px), calc(100% - 1.2rem))`,
              }}
              title={t("draw.removeSelection")}
              type="button"
            >
              <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={40} />
            </Button>
          )}
          <span aria-hidden className="brush-cursor" ref={brushCursorRef} />
          <AnimatePresence>
            {empty && !dragging && !penDown && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="stage-hint"
                exit={{ opacity: 0, scale: 0.94 }}
                initial={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <CookieIcon kind="heart" size={130} />
                <strong>{t("draw.hint")}</strong>
                <span>{t("draw.hintSub")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {dragging && (
            <div className="stage-hint drop">
              <CookieIcon icing="#2a44ff" icon={FileUp} size={110} />
              <strong>{t("draw.drop")}</strong>
            </div>
          )}
        </div>

        <ToolPicker onChoose={onChooseTool} tool={tool} />
        <div className="tool-options">
          {mode === "draw" || selection ? (
            <div className="brush">
              {/* Vorschau der Strichstärke */}
              <span
                aria-hidden
                className="brush-dot"
                style={
                  {
                    "--dot": `${4 + ((brush - 6) / 58) * 16}px`,
                  } as CSSProperties
                }
              />
              <CookieSlider
                label={t("draw.brush")}
                max={64}
                min={6}
                onChange={changeBrush}
                step={1}
                value={brush}
              />
            </div>
          ) : (
            <span className="move-hint" title={t("draw.moveHint")}>
              {t("draw.moveHint")}
            </span>
          )}
        </div>
        <div className="actions">
          <Button
            aria-label={t("draw.undo")}
            className="icon"
            disabled={!canUndo}
            onClick={undo}
            title={t("draw.undo")}
            type="button"
          >
            <CookieIcon icing="#2a44ff" icon={Undo2} roll={-12} size={52} />
          </Button>
          <Button
            aria-label={t("draw.redo")}
            className="icon"
            disabled={!canRedo}
            onClick={redo}
            title={t("draw.redo")}
            type="button"
          >
            <CookieIcon icing="#2a44ff" icon={Redo2} roll={12} size={52} />
          </Button>
          <Button
            aria-label={t("draw.clear")}
            className="icon"
            disabled={empty}
            onClick={clear}
            title={t("draw.clear")}
            type="button"
          >
            <CookieIcon icing="#ff5fa8" icon={Trash2} roll={9} size={52} />
          </Button>
        </div>

        {/* Vorlagen: Überschrift, scrollbare Karten, darunter SVG hochladen */}
        <div className="templates">
          <span aria-hidden className="presets-label">
            {t("draw.presets")}
          </span>
          {/* biome-ignore lint/a11y/useSemanticElements: Gruppe von Buttons, kein Formular */}
          <div
            aria-label={t("draw.presets")}
            className="preset-strip"
            role="group"
          >
            {presets.map((preset) => {
              const shape = shapes[preset.id];
              const name = t("draw.insert", { name: presetName(preset) });
              return (
                <Button
                  aria-label={name}
                  className="preset"
                  disabled={!shape}
                  key={preset.id}
                  onClick={() => insertPreset(preset)}
                  title={name}
                  type="button"
                >
                  {shape && (
                    <svg aria-hidden viewBox="0 0 24 24">
                      <path d={shape.path} />
                    </svg>
                  )}
                </Button>
              );
            })}
          </div>
          <Button
            className="upload"
            onClick={() => inputRef.current?.click()}
            title={t("draw.upload")}
            type="button"
          >
            <CookieIcon icing="#2a44ff" icon={Upload} roll={10} size={58} />
            {/* Neben der Fläche bleibt nur der Keks, der Text ist dann unsichtbar. */}
            <span className="upload-label">{t("draw.upload")}</span>
          </Button>
          <input
            accept=".svg,image/svg+xml,image/png"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importFile(file);
              event.target.value = "";
            }}
            ref={inputRef}
            type="file"
          />
        </div>
      </div>
    </div>
  );
};

// Ohne Props: rendert nur neu, wenn sich im Store etwas ändert, das sie liest.
export default memo(DrawCanvas);
