import { type PointerEvent, useEffect, useRef, useState } from "react";
import {
  addCopies,
  anchoredAt,
  type Box,
  detachErasers,
  everything,
  holds,
  isNothing,
  mergeSelections,
  objectAt,
  objectsTouching,
  pickDrawing,
  pointsOf,
  type Selection,
  sameSelection,
  selectionBox,
  toggleSelection,
  transformBy,
} from "../drawing";
import type { Point } from "../geometry/outline";
import { store } from "../store";
import type { Drawing } from "../url-state";
import {
  type Frame,
  frameAfter,
  grip,
  type Matrix,
  sizeCursor,
  translate,
} from "./frame";
import { boxBetween, distance } from "./gesture-math";
import { moveWithin, pinching, sizing, turning } from "./gestures";
import { type Guides, guidesFor, linesAt, snapMove, snapPoint } from "./guides";
import { type DrawingModel, frameFor } from "./use-drawing";
import type { Locate } from "./use-pen";

/** How near (CSS px) a pointer must come to a shape or a handle – a finger more. */
const REACH = { mouse: 7, touch: 18 };
/** How far (CSS px) outside a corner the pointer turns the selection. */
const TURN = 22;
/** How far (CSS px) above the frame the knob for turning stands – on touch. */
export const KNOB = 30;
/** How near (CSS px) a guide pulls – whatever the zoom. */
const SNAP = 5;
/** How far (CSS px) a press may wander and still be a click. */
const SLOP = { mouse: 3, touch: 6 };
/**
 * Two presses this soon (ms) and near (CSS px) are a double click – a
 * finger's two taps land further apart.
 */
const TWICE = { ms: 400, px: { mouse: 8, touch: 24 } };
/** Arrow keys move this far (pixels) – with ⇧ further. */
export const NUDGE = { small: 5, big: 50 };
/** A copy lands this far (pixels) off its original. */
const OFFSET = 30;

/** The turning cursor: an arrow round a corner, inked on a white edge. */
const TURN_CURSOR = (() => {
  const arc = "M7 15.5A7 7 0 1 0 9 8.5";
  const head = "M5.5 5.5 9 8.5l-3.5 3";
  const line = (color: string, width: number) =>
    `<path d='${arc}${head}' fill='none' stroke='${color}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>${line("white", 4.5)}${line("#0d1033", 2)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, alias`;
})();

type Press = {
  pointer: number;
  origin: Point;
  /** Area pixels per CSS pixel when it began. */
  per: number;
  touch: boolean;
  /** The drawing before – what one step back returns to. */
  before: Drawing;
  /** What the change is made to, and what it moves. */
  start: Drawing;
  items: Selection;
  frame: Frame;
  points: number[];
  /** The lines it may snap to – found when it first moves. */
  guides: Guides | null;
  /** Past the slop – a drag, not a click. */
  moved: boolean;
  changed: boolean;
};

type Gesture =
  | (Press & { kind: "move"; copy: boolean })
  | (Press & { kind: "size"; handle: Point })
  | (Press & { kind: "turn" })
  | (Press & { kind: "pinch"; fingers: [Point, Point] })
  | {
      kind: "marquee";
      pointer: number;
      origin: Point;
      per: number;
      touch: boolean;
      base: Selection | null;
      box: Box | null;
    };

/**
 * The move tool (V), the way Figma does it: a click selects a shape (what
 * touches is one), ⇧-click adds or takes away, a box dragged over empty
 * space selects all it touches, a click into nothing lets go. Dragging
 * moves (⇧ straight, Alt a copy); the frame's handles size it (⇧ in
 * proportion, Alt about its middle) – lines keep their width –, just
 * outside a corner turns it (⇧ in 15° steps) – on touch a knob above the
 * frame, or two fingers. What is moved or sized snaps onto the area's
 * middle and the other shapes' edges and middles (guides.ts) – not with ⌘ /
 * Ctrl – and never leaves the area. Every gesture is one step back. A
 * double click on an anchored line edits its points (`onEdit`).
 */
export const useMove = (
  model: DrawingModel,
  {
    locate,
    onEdit,
  }: {
    locate: Locate;
    onEdit: (stroke: number) => void;
  }
) => {
  const { drawing, live, remember, commit, repaint, select, put } = model;
  const [hover, setHover] = useState<Selection | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  // The guides what is dragged lies on – shown only while it is.
  const [lines, setLines] = useState<Guides | null>(null);
  // Fingers show the knob – no hover to find the turn by.
  const [touchy, setTouchy] = useState(false);
  // A drag under way – the buttons on the selection make way.
  const [moving, setMoving] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const fingers = useRef(new Map<number, Point>());
  const pressed = useRef({ time: 0, point: [0, 0] as Point });
  const clip = useRef<{ drawing: Drawing; times: number } | null>(null);

  useEffect(() => {
    setTouchy(matchMedia("(pointer: coarse)").matches);
  }, []);

  /** The selection now, and its frame. */
  const current = () => {
    const { selection, frame } = live.current;
    return selection && frame ? { items: selection, frame } : null;
  };

  /**
   * What is under a point, whole – with erasers that also take from others
   * doubled for it (drawing.ts `detachErasers`).
   */
  const thingAt = (point: Point, reach: number) =>
    objectAt(drawing.current, point, reach);

  /** Selects these, upright – erasers shared with others doubled first. */
  const choose = (items: Selection | null) => {
    if (!items || isNothing(items)) {
      select(null);
      return;
    }
    const detached = detachErasers(drawing.current, items);
    drawing.current = detached.drawing;
    select(detached.selection);
  };

  /** A change shown – the selection carried along in its frame. */
  const show = (next: Drawing, items: Selection, frame: Frame) => {
    drawing.current = next;
    repaint();
    select(items, frame);
  };

  /** A gesture done: one step. */
  const settle = (before: Drawing) => {
    remember({ drawing: before });
    commit();
  };

  const hovering = (
    event: PointerEvent<HTMLElement>,
    point: Point,
    per: number
  ) => {
    if (event.pointerType !== "mouse") return;
    const reach = REACH.mouse * per;
    const now = current();
    let cursor = "default";
    let over: Selection | null = null;
    const hit =
      now &&
      grip(now.frame, point[0], point[1], {
        reach,
        turn: TURN * per,
        knob: touchy ? KNOB * per : 0,
      });
    if (hit?.kind === "size" && now) cursor = sizeCursor(now.frame, hit.handle);
    else if (hit?.kind === "turn") cursor = TURN_CURSOR;
    else {
      over = thingAt(point, reach);
      if (over || hit?.kind === "move") cursor = "move";
      if (over && now && holds(now.items, over)) over = null;
    }
    event.currentTarget.style.cursor = cursor;
    setHover((was) => (was && over && sameSelection(was, over) ? was : over));
  };

  const down = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const { at: point, per } = locate(event);
    const touch = event.pointerType !== "mouse";
    setTouchy(touch);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer knows – it goes on all the same.
    }
    fingers.current.set(event.pointerId, point);
    const now = current();
    const going = gesture.current;

    // A second finger: the two turn and size what is selected.
    if (going && fingers.current.size === 2) {
      if (going.kind === "marquee") {
        gesture.current = null;
        setMarquee(null);
        setHover(null);
        return;
      }
      if (!now) return;
      const [a, b] = [...fingers.current.values()];
      gesture.current = {
        ...going,
        kind: "pinch",
        start: drawing.current,
        frame: now.frame,
        points: pointsOf(drawing.current, going.items),
        guides: null,
        fingers: [a, b],
        moved: true,
      };
      return;
    }
    if (fingers.current.size > 1) return;
    setHover(null);
    const reach = (touch ? REACH.touch : REACH.mouse) * per;
    // Twice on an anchored line: its points are edited.
    const before = pressed.current;
    const twice =
      event.timeStamp - before.time < TWICE.ms &&
      distance(point, before.point) / per <
        (touch ? TWICE.px.touch : TWICE.px.mouse);
    pressed.current = { time: event.timeStamp, point };
    const line = twice ? anchoredAt(drawing.current, point, reach) : null;
    if (line !== null) {
      fingers.current.delete(event.pointerId);
      onEdit(line);
      return;
    }
    const press = (items: Selection, frame: Frame): Press => ({
      pointer: event.pointerId,
      origin: point,
      per,
      touch,
      before: drawing.current,
      start: drawing.current,
      items,
      frame,
      points: pointsOf(drawing.current, items),
      guides: null,
      moved: false,
      changed: false,
    });

    const thing = thingAt(point, reach);
    if (now) {
      const hit = grip(now.frame, point[0], point[1], {
        reach,
        turn: touch ? 0 : TURN * per,
        knob: touchy || touch ? KNOB * per : 0,
      });
      const base = press(now.items, now.frame);
      if (hit?.kind === "size") {
        gesture.current = { ...base, kind: "size", handle: hit.handle };
        return;
      }
      if (hit?.kind === "turn") {
        gesture.current = { ...base, kind: "turn" };
        return;
      }
      // Inside the frame it moves – unless the press is on another shape,
      // which is selected instead (⇧: added or taken away).
      if (
        hit?.kind === "move" &&
        !event.shiftKey &&
        (!thing || holds(now.items, thing))
      ) {
        gesture.current = { ...base, kind: "move", copy: event.altKey };
        return;
      }
    }
    if (thing) {
      const items =
        event.shiftKey && now ? toggleSelection(now.items, thing) : thing;
      choose(items);
      const chosen = current();
      // Pressed on what is selected now: dragged, it moves.
      if (chosen && holds(chosen.items, thing)) {
        gesture.current = {
          ...press(chosen.items, chosen.frame),
          kind: "move",
          copy: event.altKey,
        };
      }
      return;
    }
    // Nothing there: a box to select with – ⇧ adds what it catches.
    if (!event.shiftKey) select(null);
    gesture.current = {
      kind: "marquee",
      pointer: event.pointerId,
      origin: point,
      per,
      touch,
      base: event.shiftKey && now ? now.items : null,
      box: null,
    };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const { at: point, per } = locate(event);
    if (fingers.current.has(event.pointerId)) {
      fingers.current.set(event.pointerId, point);
    }
    const g = gesture.current;
    if (!g) {
      hovering(event, point, per);
      return;
    }
    if (g.kind !== "pinch" && g.pointer !== event.pointerId) return;
    const slop = (g.touch ? SLOP.touch : SLOP.mouse) * g.per;
    if (g.kind === "marquee") {
      if (!g.box && distance(point, g.origin) < slop) return;
      g.box = boxBetween(g.origin, point);
      setMarquee(g.box);
      setHover(objectsTouching(drawing.current, g.box));
      return;
    }
    if (!g.moved) {
      if (distance(point, g.origin) < slop) return;
      g.moved = true;
      setMoving(true);
      if (g.kind === "move" && g.copy) {
        // Alt-drag: the copies move, the originals stay.
        const copies = addCopies(
          g.start,
          pickDrawing(g.start, g.items),
          0,
          0,
          moveWithin
        );
        if (copies) {
          g.start = copies.drawing;
          g.items = copies.selection;
          g.points = pointsOf(copies.drawing, copies.selection);
          g.guides = null;
        }
      }
    }
    let m: Matrix;
    // Guides pull unless ⌘ / Ctrl is held, as in Figma.
    const snapping = !(event.metaKey || event.ctrlKey);
    const reach = SNAP * g.per;
    let along: Guides | null = null;
    if (g.kind === "move") {
      let dx = point[0] - g.origin[0];
      let dy = point[1] - g.origin[1];
      const free = { x: true, y: true };
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
          free.y = false;
        } else {
          dx = 0;
          free.x = false;
        }
      }
      const box = selectionBox(g.start, g.items);
      if (snapping && box) {
        g.guides ??= guidesFor(g.start, g.items);
        [dx, dy] = snapMove(box, dx, dy, g.guides, reach, free);
      }
      [dx, dy] = moveWithin(g.points, dx, dy);
      m = translate(dx, dy);
      if (snapping && box && g.guides) {
        along = linesAt(
          {
            x0: box.x0 + dx,
            y0: box.y0 + dy,
            x1: box.x1 + dx,
            y1: box.y1 + dy,
          },
          g.guides
        );
      }
      event.currentTarget.style.cursor = "move";
    } else if (g.kind === "size") {
      const [hx, hy] = g.handle;
      let to = point;
      // An upright frame's dragged side snaps, too.
      const upright = Math.abs(Math.sin(g.frame.angle)) < 1e-9;
      if (snapping && upright) {
        g.guides ??= guidesFor(g.start, g.items);
        const x = g.frame.cx + (hx * g.frame.w) / 2 + point[0] - g.origin[0];
        const y = g.frame.cy + (hy * g.frame.h) / 2 + point[1] - g.origin[1];
        const snapped = snapPoint(x, y, g.guides, reach, {
          x: hx !== 0,
          y: hy !== 0,
        });
        to = [point[0] + snapped.x - x, point[1] + snapped.y - y];
      }
      m = sizing(g.frame, g.points, g.handle, g.origin, to, {
        even: event.shiftKey,
        centered: event.altKey,
      });
      if (snapping && upright && g.guides) {
        const f = frameAfter(g.frame, m);
        const box = {
          x0: f.cx - f.w / 2,
          y0: f.cy - f.h / 2,
          x1: f.cx + f.w / 2,
          y1: f.cy + f.h / 2,
        };
        const all = linesAt(box, g.guides);
        // Only the sides being dragged.
        const side = (v: number, low: number, high: number, h: number) =>
          (h < 0 && Math.abs(v - low) < 1e-3) ||
          (h > 0 && Math.abs(v - high) < 1e-3);
        along = {
          x: all.x.filter((v) => side(v, box.x0, box.x1, hx)),
          y: all.y.filter((v) => side(v, box.y0, box.y1, hy)),
        };
      }
    } else if (g.kind === "turn") {
      m = turning(g.frame, g.points, g.origin, point, event.shiftKey);
    } else {
      const [a, b] = [...fingers.current.values()];
      if (!(a && b)) return;
      m = pinching(g.frame, g.points, g.fingers, [a, b]);
    }
    g.changed = true;
    setLines(along && (along.x.length || along.y.length) ? along : null);
    show(transformBy(g.start, g.items, m), g.items, frameAfter(g.frame, m));
  };

  const up = (event: PointerEvent<HTMLElement>) => {
    fingers.current.delete(event.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const [rest] = [...fingers.current.entries()];
      if (rest && fingers.current.size === 1) {
        // One finger stays on: it moves on from here.
        const frame = live.current.frame ?? g.frame;
        gesture.current = {
          ...g,
          kind: "move",
          copy: false,
          pointer: rest[0],
          origin: rest[1],
          start: drawing.current,
          frame,
          points: pointsOf(drawing.current, g.items),
          guides: null,
          moved: true,
        };
        return;
      }
      if (fingers.current.size) return;
    } else if (g.pointer !== event.pointerId) return;
    gesture.current = null;
    setLines(null);
    setMoving(false);
    if (g.kind === "marquee") {
      setMarquee(null);
      setHover(null);
      if (!g.box) return;
      const caught = objectsTouching(drawing.current, g.box);
      choose(
        g.base && caught ? mergeSelections(g.base, caught) : (caught ?? g.base)
      );
      return;
    }
    if (g.changed) settle(g.before);
  };

  /**
   * Whatever is under way stops – two fingers took over (they zoom): what
   * it changed so far stays, as one step.
   */
  const cancel = () => {
    const g = gesture.current;
    gesture.current = null;
    fingers.current.clear();
    setMarquee(null);
    setLines(null);
    setMoving(false);
    if (g && g.kind !== "marquee" && g.changed) settle(g.before);
  };

  /** Moved by (dx, dy) – arrow keys; one step. */
  const nudge = (dx: number, dy: number) => {
    const now = current();
    if (!now) return;
    const [mx, my] = moveWithin(pointsOf(drawing.current, now.items), dx, dy);
    if (!(mx || my)) return;
    const m = translate(mx, my);
    put(
      transformBy(drawing.current, now.items, m),
      now.items,
      frameAfter(now.frame, m)
    );
  };

  /** Copies laid down – picked – as one step. */
  const lay = (copies: Drawing, shift: number) => {
    const added = addCopies(drawing.current, copies, shift, shift, moveWithin);
    if (!added) return;
    put(added.drawing, added.selection);
  };

  return {
    hover: store.tool === "move" ? hover : null,
    marquee: store.tool === "move" ? marquee : null,
    lines: store.tool === "move" ? lines : null,
    /** Fingers: a knob above the frame turns it. */
    knob: touchy,
    down,
    move,
    up,
    cancel,
    leave: () => setHover(null),
    /** Two fingers turn and size what is selected – they don't zoom. */
    pinching: () => gesture.current?.kind === "pinch",
    /** A drag under way. */
    moving,
    clear: () => select(null),
    all: () => choose(everything(drawing.current)),
    nudge,
    duplicate: () => {
      const now = current();
      if (now) lay(pickDrawing(drawing.current, now.items), OFFSET);
    },
    copy: () => {
      const now = current();
      if (now) {
        clip.current = {
          drawing: pickDrawing(drawing.current, now.items),
          times: 0,
        };
      }
    },
    cut: () => {
      const now = current();
      if (!now) return;
      clip.current = {
        drawing: pickDrawing(drawing.current, now.items),
        times: 0,
      };
      model.removeSelected();
    },
    /** Whether there is something to paste – then it is pasted. */
    paste: () => {
      const held = clip.current;
      if (!held) return false;
      held.times += 1;
      lay(held.drawing, OFFSET * held.times);
      return true;
    },
  };
};

export { frameFor };
