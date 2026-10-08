import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../analytics";
import {
  type Box,
  DRAW_RES as RES,
  detachErasers,
  paint,
  presetStrokes,
  removeSelection,
  type Selection,
  selectionBox,
  selectionWidth,
  setStrokeWidth,
} from "../drawing";
import { loadSilhouette, traceOutline } from "../geometry/outline";
import { loadPreset, type Preset } from "../presets";
import { drawingChanged, importFailed, initial, store } from "../store";
import { type Drawing, emptyDrawing, isEmptyDrawing } from "../url-state";
import { useHistory } from "./use-history";

/** Margin around imported SVGs, so they do not stick to the edge. */
const IMPORT_MARGIN = 0.1;

/** The drawing area as it was – a step to undo. */
export type Snapshot = { image: ImageData; drawing: Drawing };

/**
 * What is drawn: as vectors – they are shared and moved – and painted on
 * the canvas; what of it is selected, and the steps to undo. Every finished
 * change goes to the store (drawingChanged), which shapes the cutter from
 * it. The keys: ⌘/Ctrl+Z undoes, with shift (or Ctrl+Y) redoes; Escape
 * lets go of the selection, Delete removes it.
 */
export const useDrawing = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Drawing>(initial.drawing);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [empty, setEmpty] = useState(isEmptyDrawing(initial.drawing));
  // For listeners outside React (wheel, keyboard): always the latest state.
  const live = useRef({ selection, box });
  live.current = { selection, box };
  const history = useHistory<Snapshot>();
  /** A slider move in progress – one undo step for all of it. */
  const widthEdit = useRef<{ before: Snapshot; timer: number } | null>(null);

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

  /** Remembers the state as it is now – before a change. */
  const snapshot = () => {
    const entry = capture();
    if (entry) history.remember(entry);
  };

  /** Repaints the whole drawing from the vectors. */
  const repaint = () => {
    const ctx = context();
    if (!ctx) return;
    ctx.clearRect(0, 0, RES, RES);
    paint(ctx, drawing.current);
  };

  /** The selection's box anew – after its strokes changed. */
  const reframe = (chosen: Selection) => {
    const next = selectionBox(drawing.current, chosen);
    setBox(next);
    live.current = { ...live.current, box: next };
  };

  const select = (next: Selection | null) => {
    setSelection(next);
    const nextBox = next ? selectionBox(drawing.current, next) : null;
    setBox(nextBox);
    live.current = { selection: next, box: nextBox };
    // The slider shows the selection's stroke width (and changes it).
    const width = next ? selectionWidth(drawing.current, next) : null;
    if (width) store.brush = Math.round(Math.min(64, Math.max(6, width)));
  };

  /** Restores a saved state. */
  const restore = (state: Snapshot) => {
    const ctx = context();
    if (!ctx) return;
    ctx.putImageData(state.image, 0, 0);
    drawing.current = state.drawing;
    select(null);
    commit();
  };

  const undo = () => {
    const current = capture();
    const previous = current && history.back(current);
    if (previous) restore(previous);
  };

  const redo = () => {
    const current = capture();
    const next = current && history.forward(current);
    if (next) restore(next);
  };

  /** Brush size; with a selection in move mode its strokes too. */
  const changeBrush = (value: number) => {
    store.brush = value;
    const chosen = live.current.selection;
    if (store.tool !== "move" || !chosen) return;
    const before = widthEdit.current?.before ?? capture();
    if (!before) return;
    if (widthEdit.current) window.clearTimeout(widthEdit.current.timer);
    drawing.current = setStrokeWidth(drawing.current, chosen, value);
    repaint();
    reframe(chosen);
    // One slider move = one undo step, then recompute.
    const timer = window.setTimeout(() => {
      widthEdit.current = null;
      history.remember(before);
      commit();
    }, 300);
    widthEdit.current = { before, timer };
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
    // Shared erasers stay for the other objects.
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
      // The silhouette is shared as an area, not the SVG itself.
      const canvas = canvasRef.current;
      drawing.current = {
        base: canvas ? traceOutline(canvas) : [],
        baseLine: 0,
        strokes: [],
      };
      select(null);
      commit();
      trackEvent("svg-import");
    } catch (error) {
      importFailed(error);
    }
  };

  /**
   * Inserts a template as an outline in brush width – large on an empty area,
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
        store.brush
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
      // Only the template – it merges only once you let go and select again.
      select({ strokes: strokes.map((_, i) => first + i), rings: [] });
      trackEvent("template");
    } catch (error) {
      importFailed(error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: on start only
  useEffect(() => {
    const ctx = context();
    if (!ctx || isEmptyDrawing(initial.drawing)) return;
    paint(ctx, initial.drawing);
    if (initial.trace) commit();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) redo();
        else undo();
        return;
      }
      // In the name field and the like, the keys belong to the field.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (store.tool !== "move" || !live.current.selection) return;
      if (event.key === "Escape") select(null);
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return {
    canvasRef,
    drawing,
    live,
    selection,
    box,
    empty,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    context,
    capture,
    remember: history.remember,
    snapshot,
    commit,
    repaint,
    select,
    reframe,
    undo,
    redo,
    changeBrush,
    clear,
    removeSelected,
    importFile,
    insertPreset,
  };
};

export type DrawingModel = ReturnType<typeof useDrawing>;
