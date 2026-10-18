import { useEffect, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import {
  detachErasers,
  type Ink,
  paint,
  presetStrokes,
  DRAW_RES as RES,
  removeSelection,
  type Selection,
  selectionBox,
  selectionInk,
  selectionWidth,
  setStrokeInk,
  setStrokeWidth,
} from "../drawing";
import { loadSilhouette, traceOutline } from "../geometry/outline";
import { loadPreset, type Preset } from "../presets";
import { drawingChanged, importFailed, initial, store } from "../store";
import {
  type Drawing,
  emptyDrawing,
  isEmptyDrawing,
  withAreaInks,
} from "../url-state";
import { type Frame, frameAround } from "./frame";
import { useHistory } from "./use-history";
import { type View, WHOLE } from "./view";

/** Margin around imported SVGs, so they do not stick to the edge. */
const IMPORT_MARGIN = 0.1;

/** The drawing as it was – a step to undo. */
export type Snapshot = { drawing: Drawing };

/** The frame round a selection, upright – or null for nothing to frame. */
export const frameFor = (drawing: Drawing, selection: Selection) => {
  const box = selectionBox(drawing, selection);
  return box && frameAround(box);
};

/**
 * What is drawn: as vectors – they are shared, moved and traced – and
 * painted on the canvas, through the view (zoomed in or not, sharp on any
 * screen); what of it is selected, and the steps to undo. Every finished
 * change goes to the store (drawingChanged), which shapes the cutter from
 * it.
 */
export const useDrawing = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Drawing>(initial.drawing);
  const [selection, setSelection] = useState<Selection | null>(null);
  // The selection's frame – turned along as it is turned, like Figma's.
  const [frame, setFrame] = useState<Frame | null>(null);
  const [empty, setEmpty] = useState(isEmptyDrawing(initial.drawing));
  // For listeners outside React (keys, the pointer's gestures): always the latest.
  const live = useRef({ selection, frame });
  live.current = { selection, frame };
  // The view the canvas shows – set by the zoom (draw-canvas.tsx).
  const view = useRef<View>(WHOLE);
  const history = useHistory<Snapshot>();
  /** A slider move in progress – one undo step for all of it. */
  const widthEdit = useRef<{ before: Snapshot; timer: number } | null>(null);
  /** The line whose points are edited (use-line.ts) – the slider is its. */
  const editing = useRef<number | null>(null);

  /** What the slider and the inks change: the selection, or the edited line. */
  const target = (): Selection | null => {
    if (store.tool === "move") return live.current.selection;
    if (store.tool === "points" && editing.current !== null) {
      return { strokes: [editing.current], rings: [] };
    }
    return null;
  };

  /**
   * The canvas' context, drawing-area pixels in – through the view: one
   * pixel of the area is as many of the canvas as the stage and the zoom
   * make it.
   */
  const context = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx)) return null;
    const { s, x, y } = view.current;
    const k = (canvas.width / RES) * s;
    ctx.setTransform(k, 0, 0, k, x * canvas.width, y * canvas.height);
    return ctx;
  };

  const commit = () => {
    setEmpty(isEmptyDrawing(drawing.current));
    drawingChanged(drawing.current);
  };

  const capture = (): Snapshot => ({ drawing: drawing.current });

  /** Remembers the state as it is now – before a change. */
  const snapshot = () => history.remember(capture());

  /** Repaints the whole drawing from the vectors, through the view. */
  const repaint = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!(canvas && ctx)) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    paint(ctx, drawing.current);
  };

  /** Shown through another view – the zoom moved. */
  const setView = (next: View) => {
    view.current = next;
    repaint();
  };

  /** The selection's frame anew, upright – after its strokes changed. */
  const reframe = (chosen: Selection) => {
    const next = frameFor(drawing.current, chosen);
    setFrame(next);
    live.current = { ...live.current, frame: next };
  };

  /**
   * Selects – with the frame it is carried in (turned along), or upright
   * round it.
   */
  const select = (next: Selection | null, carried?: Frame | null) => {
    setSelection(next);
    const nextFrame = next
      ? (carried ?? frameFor(drawing.current, next))
      : null;
    setFrame(nextFrame);
    live.current = { selection: next, frame: nextFrame };
    // The slider shows the selection's stroke width (and changes it), the
    // swatches its ink.
    const width = next ? selectionWidth(drawing.current, next) : null;
    if (width) store.brush = Math.round(Math.min(64, Math.max(6, width)));
    const ink = next ? selectionInk(drawing.current, next) : null;
    if (ink) store.ink = ink;
  };

  /** Restores a saved state. */
  const restore = (state: Snapshot) => {
    drawing.current = state.drawing;
    repaint();
    select(null);
    commit();
  };

  const undo = () => {
    const previous = history.back(capture());
    if (previous) restore(previous);
  };

  const redo = () => {
    const next = history.forward(capture());
    if (next) restore(next);
  };

  /** A change as a step of its own, taken at once – the selection carried along. */
  const put = (next: Drawing, chosen: Selection | null, carried?: Frame) => {
    snapshot();
    drawing.current = next;
    repaint();
    select(chosen, carried);
    commit();
  };

  /** Brush size; with a selection in move mode its strokes too. */
  const changeBrush = (value: number) => {
    store.brush = value;
    const chosen = target();
    if (!chosen) return;
    const before = widthEdit.current?.before ?? capture();
    if (widthEdit.current) window.clearTimeout(widthEdit.current.timer);
    drawing.current = setStrokeWidth(drawing.current, chosen, value);
    repaint();
    // An upright frame hugs the new widths; a turned one stays as it is.
    if (store.tool === "move" && !live.current.frame?.angle) reframe(chosen);
    // One slider move = one undo step, then recompute.
    const timer = window.setTimeout(() => {
      widthEdit.current = null;
      history.remember(before);
      commit();
    }, 300);
    widthEdit.current = { before, timer };
  };

  /** The pen's ink; with a selection in move mode, its strokes take it. */
  const changeInk = (ink: Ink) => {
    store.ink = ink;
    const chosen = target();
    if (!chosen) return;
    if (selectionInk(drawing.current, chosen) === ink) return;
    snapshot();
    drawing.current = setStrokeInk(drawing.current, chosen, ink);
    repaint();
    commit();
  };

  const clear = () => {
    snapshot();
    drawing.current = emptyDrawing;
    repaint();
    select(null);
    commit();
  };

  const removeSelected = () => {
    const current = live.current.selection;
    if (!current) return;
    // Shared erasers stay for the other objects.
    const detached = detachErasers(drawing.current, current);
    put(removeSelection(detached.drawing, detached.selection), null);
  };

  const importFile = async (file: File) => {
    // Laid on a canvas of its own, as large as the area, and traced there.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = RES;
    const ctx = canvas.getContext("2d");
    try {
      if (!ctx) throw new Error("No canvas");
      const silhouette = await loadSilhouette(file, RES);
      const inner = RES * (1 - 2 * IMPORT_MARGIN);
      const scale = inner / Math.max(silhouette.width, silhouette.height);
      const w = silhouette.width * scale;
      const h = silhouette.height * scale;
      ctx.drawImage(silhouette, (RES - w) / 2, (RES - h) / 2, w, h);
      // The silhouette is shared as an area, not the SVG itself – in the
      // pen's ink, like a template; shown as it is shared.
      const base = traceOutline(canvas);
      snapshot();
      drawing.current = withAreaInks(
        { base, baseLine: 0, strokes: [] },
        base.map(() => store.ink === "emboss")
      );
      repaint();
      select(null);
      commit();
      trackEvent("svg-import");
    } catch (error) {
      importFailed(error);
    } finally {
      // Freed right away: iOS Safari's canvas memory is tight and freed late.
      canvas.width = canvas.height = 0;
    }
  };

  /**
   * Inserts a template as an outline in brush width and the pen's ink – large on an empty area,
   * otherwise smaller in the middle (e.g. as a hole in a shape) – and selects
   * it for moving.
   */
  const insertPreset = async (preset: Preset) => {
    try {
      const shape = await loadPreset(preset);
      const size = (isEmptyDrawing(drawing.current) ? 0.6 : 0.24) * RES;
      const strokes = presetStrokes(
        shape.rings,
        [RES / 2, RES / 2],
        size,
        store.brush,
        store.ink
      );
      if (strokes.length === 0) return;
      const first = drawing.current.strokes.length;
      store.tool = "move";
      // Only the template – it merges only once you let go and select again.
      put(
        {
          ...drawing.current,
          strokes: [...drawing.current.strokes, ...strokes],
        },
        { strokes: strokes.map((_, i) => first + i), rings: [] }
      );
      trackEvent("template");
    } catch (error) {
      importFailed(error);
    }
  };

  // The canvas as many pixels as it shows on this screen – sharp, zoomed in
  // too; painted anew whenever its size changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on start only
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sized = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const side = Math.max(1, Math.round(canvas.clientWidth * ratio));
      if (canvas.width === side && canvas.height === side) return;
      canvas.width = canvas.height = side;
      repaint();
    };
    sized();
    const watch = new ResizeObserver(sized);
    watch.observe(canvas);
    return () => watch.disconnect();
  }, []);

  // The link's drawing, once the browser has read it (store.ts `boot`):
  // painted, and – a drawing, not just an old link's contour – traced.
  const { booted } = useSnapshot(store);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when booted
  useEffect(() => {
    if (!booted) return;
    drawing.current = initial.drawing;
    setEmpty(isEmptyDrawing(initial.drawing));
    select(null);
    repaint();
    if (initial.trace && !isEmptyDrawing(initial.drawing)) commit();
  }, [booted]);

  return {
    canvasRef,
    drawing,
    live,
    view,
    editing,
    selection,
    frame,
    empty,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    context,
    capture,
    remember: history.remember,
    snapshot,
    commit,
    repaint,
    setView,
    select,
    reframe,
    put,
    undo,
    redo,
    changeBrush,
    changeInk,
    clear,
    removeSelected,
    importFile,
    insertPreset,
  };
};

export type DrawingModel = ReturnType<typeof useDrawing>;
