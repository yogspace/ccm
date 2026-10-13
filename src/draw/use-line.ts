import { type PointerEvent, useEffect, useRef, useState } from "react";
import {
  ANCHOR,
  anchorCount,
  anchorGuides,
  type Guides,
  insertAnchor,
  lineStroke,
  moveAnchor,
  moveHandle,
  pathGrip,
  pullHandles,
  removeAnchor,
  snap45,
  snapPoint,
  toggleSmooth,
} from "../bezier";
import { anchoredAt, DRAW_RES as RES } from "../drawing";
import type { Point } from "../geometry/outline";
import { store, type Tool } from "../store";
import type { Drawing, Stroke } from "../url-state";
import { toPoint } from "./gesture-math";
import type { DrawingModel, Snapshot } from "./use-drawing";

/** How near (CSS px) a pointer must come to an anchor or a handle – a finger more. */
const REACH = { mouse: 8, touch: 18 };
/** How near (CSS px) a guide pulls. */
const SNAP = 5;
/** How far (CSS px) a press may wander and still be a click. */
const SLOP = { mouse: 3, touch: 6 };

/** A press under way: what it is on, and the drawing it changes. */
type Press = {
  kind: "lone" | "new" | "close" | "anchor" | "in" | "out";
  stroke: number;
  anchor: number;
  /** The drawing the change is made to. */
  start: Drawing;
  /** What one step back returns to – null: the press made its step already. */
  before: Snapshot | null;
  origin: Point;
  /** Drawing-area pixels per CSS pixel. */
  scale: number;
  touch: boolean;
  moved: boolean;
  changed: boolean;
};

/** What the tool draws over the drawing (line-marks.tsx). */
export type LineMarking = {
  anchors: readonly number[];
  /** The line as it is drawn – its points. */
  line: readonly Point[];
  /** The anchor picked – its square filled. */
  picked: number | null;
  /** Whose handles show: every anchor's, or the last one's. */
  handles: "all" | "last";
  /** The next curve, to the pointer: a cubic's eight numbers. */
  preview: readonly number[] | null;
  /** The pointer is on the first anchor – a press closes the line. */
  closing: boolean;
};

const inArea = (n: number) => Math.min(Math.max(n, 0), RES);

/** The drawing with one of its strokes replaced. */
const replaced = (drawing: Drawing, index: number, stroke: Stroke) => ({
  ...drawing,
  strokes: drawing.strokes.map((s, i) => (i === index ? stroke : s)),
});

/** A stroke with other anchors – its width, ink and closing kept. */
const reshaped = (
  stroke: Stroke,
  anchors: readonly number[],
  closed?: boolean
) => lineStroke(stroke, anchors, closed ?? Boolean(stroke.closed));

/**
 * The line tool and editing its lines' points, the way Figma and
 * Illustrator do it – not the pen, which draws freehand.
 *
 * - **Drawing** (`line`): clicks set points, straight lines between them; a
 *   press dragged bends the line there into a curve – a smooth point, its
 *   handles pulled out, mirrored (Alt: only the one ahead – a corner with a
 *   curve; ⇧: in 45° steps). A press on the first point closes the line –
 *   its inside is filled like any closed stroke. Each point is an undo
 *   step; ⌫ takes the last one away, Enter or Escape – or another tool –
 *   ends the line. Until its second point a line is not in the drawing yet
 *   (`lone`).
 * - **Editing** (`points`): anchors and handles are dragged (a smooth
 *   point's handles stay mirrored – not with Alt), Alt-click switches smooth
 *   and corner, a click on the line puts a point there, Delete takes the
 *   picked one away. A press beside the line edits another such line – or
 *   leaves (`onLeave`).
 *
 * New and dragged anchors snap to the area's middle and level with or above
 * other anchors, unless ⌘ / Ctrl is held. Such a line – an anchored line –
 * is an ordinary stroke with its anchors kept (bezier.ts `lineStroke`).
 */
export const useLine = (
  {
    drawing,
    editing: editingRef,
    snapshot,
    capture,
    remember,
    commit,
    repaint,
  }: DrawingModel,
  {
    tool,
    onLeave,
  }: {
    tool: Tool;
    /** Editing is over – back to moving, with this line picked (or nothing). */
    onLeave: (stroke: number | null) => void;
  }
) => {
  const mode = tool === "line" || tool === "points" ? tool : null;
  // Drawing: the first anchor before there is a line, then the line's place.
  const [lone, setLone] = useState<number[] | null>(null);
  const [drawn, setDrawn] = useState<number | null>(null);
  // Editing: the line, and the anchor picked on it.
  const [edited, setEdited] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    closing: boolean;
  } | null>(null);
  const [lines, setLines] = useState<Guides | null>(null);
  // The drawing is a ref – a new version of it shows by this.
  const [, setVersion] = useState(0);
  const press = useRef<Press | null>(null);

  const now = drawing.current;
  // The line being drawn is the drawing's last, an anchored line still open –
  // an undo that takes it away ends it.
  const last = now.strokes.at(-1);
  const drawingAt =
    mode === "line" &&
    drawn !== null &&
    drawn === now.strokes.length - 1 &&
    last?.anchors &&
    !last.closed
      ? drawn
      : null;
  const editing =
    mode === "points" && edited !== null && now.strokes[edited]?.anchors
      ? edited
      : null;
  editingRef.current = editing;

  // Another tool: nothing under way.
  useEffect(() => {
    if (mode !== "line") {
      setLone(null);
      setDrawn(null);
      setHover(null);
    }
    if (mode !== "points") {
      setEdited(null);
      setAnchor(null);
    }
    setLines(null);
    press.current = null;
  }, [mode]);

  /** The drawing as it is meanwhile – shown, not yet a step. */
  const show = (next: Drawing) => {
    drawing.current = next;
    repaint();
    setVersion((v) => v + 1);
  };

  /** A change as a step of its own, taken at once. */
  const put = (next: Drawing) => {
    snapshot();
    show(next);
    commit();
  };

  /** The anchors of the line being drawn – its one, before it is a line. */
  const draft = () =>
    drawingAt !== null
      ? (drawing.current.strokes[drawingAt].anchors ?? [])
      : (lone ?? []);

  const anchorsOfAll = () => drawing.current.strokes.map((s) => s.anchors);

  /** Where a new or dragged anchor goes: in the area, onto a guide near it. */
  const snapped = (
    x: number,
    y: number,
    event: PointerEvent,
    scale: number,
    guides: () => Guides
  ): Point => {
    if (event.metaKey || event.ctrlKey) {
      setLines(null);
      return [inArea(x), inArea(y)];
    }
    const at = snapPoint(inArea(x), inArea(y), guides(), SNAP * scale);
    setLines(at.lines.x.length || at.lines.y.length ? at.lines : null);
    return [at.x, at.y];
  };

  /** Where a new point goes: ⇧ in 45° steps from the last anchor, else snapped. */
  const linePoint = (
    event: PointerEvent,
    x: number,
    y: number,
    scale: number
  ): Point => {
    const anchors = draft();
    const n = anchorCount(anchors);
    if (event.shiftKey && n) {
      const k = (n - 1) * ANCHOR;
      const [sx, sy] = snap45(anchors[k], anchors[k + 1], x, y);
      setLines(null);
      return [inArea(sx), inArea(sy)];
    }
    return snapped(x, y, event, scale, () =>
      anchorGuides(anchorsOfAll(), lone ?? [])
    );
  };

  /** Whether a point is on the first anchor of a line that can close. */
  const onFirst = (x: number, y: number, reach: number) => {
    const anchors = draft();
    return (
      drawingAt !== null &&
      anchorCount(anchors) >= 2 &&
      Math.hypot(anchors[0] - x, anchors[1] - y) <= reach
    );
  };

  const begin = (
    event: PointerEvent,
    at: Point,
    scale: number,
    rest: Pick<Press, "kind" | "stroke" | "anchor" | "start" | "before">
  ) => {
    press.current = {
      ...rest,
      origin: at,
      scale,
      touch: event.pointerType !== "mouse",
      moved: false,
      changed: false,
    };
  };

  const downLine = (
    event: PointerEvent,
    [x0, y0]: Point,
    scale: number,
    reach: number
  ) => {
    setHover(null);
    const current = drawing.current;
    if (drawingAt !== null && onFirst(x0, y0, reach)) {
      // Onto the first point: the line closes – dragged on, it bends in.
      const stroke = current.strokes[drawingAt];
      const next = replaced(
        current,
        drawingAt,
        reshaped(stroke, stroke.anchors ?? [], true)
      );
      put(next);
      setLines(null);
      begin(event, [x0, y0], scale, {
        kind: "close",
        stroke: drawingAt,
        anchor: 0,
        start: next,
        before: null,
      });
      return;
    }
    const [x, y] = linePoint(event, x0, y0, scale);
    const added = [x, y, x, y, x, y];
    if (drawingAt !== null) {
      const stroke = current.strokes[drawingAt];
      const a = [...(stroke.anchors ?? []), ...added];
      const next = replaced(current, drawingAt, reshaped(stroke, a));
      put(next);
      begin(event, [x0, y0], scale, {
        kind: "new",
        stroke: drawingAt,
        anchor: anchorCount(a) - 1,
        start: next,
        before: null,
      });
    } else if (lone) {
      // The second point: now it is a line, and in the drawing – in the
      // brush's width and the pen's ink.
      const index = current.strokes.length;
      const stroke = lineStroke(
        { width: store.brush, emboss: store.ink === "emboss" },
        [...lone, ...added]
      );
      const next = { ...current, strokes: [...current.strokes, stroke] };
      put(next);
      setLone(null);
      setDrawn(index);
      begin(event, [x0, y0], scale, {
        kind: "new",
        stroke: index,
        anchor: 1,
        start: next,
        before: null,
      });
    } else {
      setLone(added);
      setDrawn(null);
      begin(event, [x0, y0], scale, {
        kind: "lone",
        stroke: -1,
        anchor: 0,
        start: current,
        before: null,
      });
    }
  };

  /** Editing begins on this line – the slider and inks show its. */
  const edit = (index: number) => {
    const stroke = drawing.current.strokes[index];
    if (!stroke?.anchors) return;
    setEdited(index);
    setAnchor(null);
    editingRef.current = index;
    store.brush = Math.round(Math.min(64, Math.max(6, stroke.width)));
    store.ink = stroke.emboss ? "emboss" : "cut";
  };

  const downPoints = (
    event: PointerEvent,
    at: Point,
    scale: number,
    reach: number
  ) => {
    const current = drawing.current;
    if (editing !== null) {
      const stroke = current.strokes[editing];
      const a = stroke.anchors ?? [];
      const closed = Boolean(stroke.closed);
      const hit = pathGrip(a, closed, at[0], at[1], reach, stroke.width / 2);
      if (hit?.kind === "anchor" && event.altKey) {
        setAnchor(hit.i);
        put(
          replaced(
            current,
            editing,
            reshaped(stroke, toggleSmooth(a, closed, hit.i))
          )
        );
        return;
      }
      if (hit?.kind === "line") {
        // A new point where the line is – dragged on, it moves (one step).
        const added = insertAnchor(a, hit.curve, hit.t);
        const next = replaced(current, editing, reshaped(stroke, added.a));
        put(next);
        setAnchor(added.index);
        begin(event, at, scale, {
          kind: "anchor",
          stroke: editing,
          anchor: added.index,
          start: next,
          before: null,
        });
        return;
      }
      if (hit) {
        setAnchor(hit.i);
        begin(event, at, scale, {
          kind: hit.kind,
          stroke: editing,
          anchor: hit.i,
          start: current,
          before: capture(),
        });
        return;
      }
    }
    // Beside it: another anchored line is edited – or editing is over.
    const index = anchoredAt(current, at, reach);
    if (index !== null) edit(index);
    else onLeave(editing);
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (press.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const at = toPoint(event, rect);
    const scale = RES / rect.width;
    event.currentTarget.setPointerCapture(event.pointerId);
    const touch = event.pointerType !== "mouse";
    const reach = (touch ? REACH.touch : REACH.mouse) * scale;
    if (mode === "line") downLine(event, at, scale, reach);
    else if (mode === "points") downPoints(event, at, scale, reach);
  };

  const hovering = (
    event: PointerEvent<HTMLCanvasElement>,
    at: Point,
    scale: number
  ) => {
    if (event.pointerType !== "mouse") return;
    const reach = REACH.mouse * scale;
    if (mode === "line") {
      if (onFirst(at[0], at[1], reach)) {
        const anchors = draft();
        setLines(null);
        setHover({ x: anchors[0], y: anchors[1], closing: true });
      } else {
        const [x, y] = linePoint(event, at[0], at[1], scale);
        setHover({ x, y, closing: false });
      }
      return;
    }
    // Editing: the pointer says what a press would do.
    let cursor = "default";
    const stroke = editing !== null ? drawing.current.strokes[editing] : null;
    const hit =
      stroke &&
      pathGrip(
        stroke.anchors ?? [],
        Boolean(stroke.closed),
        at[0],
        at[1],
        reach,
        stroke.width / 2
      );
    if (hit) cursor = hit.kind === "line" ? "copy" : "move";
    else if (anchoredAt(drawing.current, at, reach) !== null) {
      cursor = "pointer";
    }
    event.currentTarget.style.cursor = cursor;
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = toPoint(event, rect);
    const scale = RES / rect.width;
    const p = press.current;
    if (!p) {
      hovering(event, at, scale);
      return;
    }
    if (!p.moved) {
      const slop = (p.touch ? SLOP.touch : SLOP.mouse) * p.scale;
      if (Math.hypot(at[0] - p.origin[0], at[1] - p.origin[1]) < slop) return;
      p.moved = true;
    }
    if (p.kind === "lone") {
      if (!lone) return;
      const [x, y] = event.shiftKey
        ? snap45(lone[0], lone[1], at[0], at[1])
        : at;
      setLone(pullHandles(lone, 0, inArea(x), inArea(y), event.altKey));
      return;
    }
    const stroke = p.start.strokes[p.stroke];
    const a = stroke?.anchors;
    if (!a) return;
    const k = p.anchor * ANCHOR;
    let next: number[];
    if (p.kind === "anchor") {
      const [x, y] = snapped(at[0], at[1], event, p.scale, () =>
        anchorGuides(
          p.start.strokes.map((s) => s.anchors),
          [],
          { line: p.stroke, anchor: p.anchor }
        )
      );
      next = moveAnchor(a, p.anchor, x, y);
    } else {
      // A handle: ⇧ in 45° steps about its anchor.
      const [hx, hy] = event.shiftKey
        ? snap45(a[k], a[k + 1], at[0], at[1])
        : at;
      const x = inArea(hx);
      const y = inArea(hy);
      if (p.kind === "new") next = pullHandles(a, p.anchor, x, y, event.altKey);
      else if (p.kind === "close") {
        // Only the handle in – the first curve stays as it was drawn.
        next = moveHandle(a, 0, "in", 2 * a[0] - x, 2 * a[1] - y, true);
      } else next = moveHandle(a, p.anchor, p.kind, x, y, event.altKey);
    }
    p.changed = true;
    show(replaced(p.start, p.stroke, reshaped(stroke, next)));
  };

  /** The line being drawn is done – it stays as it is. */
  const finish = () => {
    setLone(null);
    setDrawn(null);
    setHover(null);
    setLines(null);
    press.current = null;
  };

  const up = () => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    setLines(null);
    if (p.changed) {
      if (p.before) remember(p.before);
      commit();
    }
    if (p.kind === "close") finish();
  };

  /** The last point of the line being drawn taken away – a step. */
  const back = () => {
    const current = drawing.current;
    if (drawingAt !== null) {
      const line = current.strokes[drawingAt];
      const a = line.anchors ?? [];
      const n = anchorCount(a);
      if (n > 2) {
        put(
          replaced(current, drawingAt, reshaped(line, removeAnchor(a, n - 1)))
        );
      } else {
        // Down to its first point: no line any more.
        put({ ...current, strokes: current.strokes.slice(0, -1) });
        setLone(a.slice(0, ANCHOR));
        setDrawn(null);
      }
    } else setLone(null);
    setHover(null);
  };

  /** The picked point taken away – with fewer than two, the line. */
  const removePoint = () => {
    const current = drawing.current;
    const stroke = editing !== null ? current.strokes[editing] : null;
    if (!stroke?.anchors || editing === null || anchor === null) return;
    setAnchor(null);
    if (anchorCount(stroke.anchors) <= 2) {
      put({
        ...current,
        strokes: current.strokes.filter((_, i) => i !== editing),
      });
      onLeave(null);
      return;
    }
    put(
      replaced(
        current,
        editing,
        reshaped(stroke, removeAnchor(stroke.anchors, anchor))
      )
    );
  };

  const active = mode === "line" && anchorCount(draft()) > 0;

  // The keys, while not in a field: drawing, Enter or Escape ends the line,
  // ⌫ takes its last point; editing, Delete takes the picked point, Escape
  // or Enter is done.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable]")) return;
    const removes = event.key === "Delete" || event.key === "Backspace";
    const ends = event.key === "Enter" || event.key === "Escape";
    if (mode === "line" && active && ends) {
      event.preventDefault();
      finish();
    } else if (mode === "line" && active && removes) {
      event.preventDefault();
      back();
    } else if (mode === "points" && ends) {
      event.preventDefault();
      onLeave(editing);
    } else if (mode === "points" && anchor !== null && removes) {
      event.preventDefault();
      removePoint();
    }
  };
  useEffect(() => {
    if (!mode) return;
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const anchors = draft();
  const count = anchorCount(anchors);
  const from = (count - 1) * ANCHOR;
  const stroke = editing !== null ? now.strokes[editing] : null;
  let marks: LineMarking | null = null;
  if (mode === "line" && count) {
    marks = {
      anchors,
      line: drawingAt !== null ? now.strokes[drawingAt].points : [],
      picked: null,
      handles: "last",
      preview: !hover
        ? null
        : [
            anchors[from],
            anchors[from + 1],
            anchors[from + 4],
            anchors[from + 5],
            ...(hover.closing
              ? [anchors[2], anchors[3], anchors[0], anchors[1]]
              : [hover.x, hover.y, hover.x, hover.y]),
          ],
      closing: Boolean(hover?.closing),
    };
  } else if (stroke?.anchors) {
    marks = {
      anchors: stroke.anchors,
      line: stroke.points,
      picked: anchor,
      handles: "all",
      preview: null,
      closing: false,
    };
  }

  return {
    down,
    move,
    up,
    leave: () => {
      setHover(null);
      if (!press.current) setLines(null);
    },
    marks,
    lines: mode ? lines : null,
    /** A line is being drawn – there is something to finish. */
    active,
    finish,
    edit,
    /** The line whose points are edited, and the one picked on it. */
    editing,
    anchor: editing !== null ? anchor : null,
    removePoint,
  };
};
