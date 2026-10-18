import { type PointerEvent, type RefObject, useRef, useState } from "react";
import type { Tool } from "../store";
import { onStage } from "./gesture-math";
import type { LoupeHandle } from "./loupe";
import type { useLine } from "./use-line";
import type { useMove } from "./use-move";
import type { usePen } from "./use-pen";
import { movedBy, pinched, type View } from "./view";

/**
 * A second finger this soon (ms) after the first makes them a pinch – the
 * line just begun goes. Later it is a palm, and left out.
 */
const PINCH_SOON = 250;
/** A finger on the line tool waits this long (ms) or this far (px) – a second may come. */
const HOLD = { ms: 160, px: 6 };

type Spot = readonly [number, number];

/** The view moved by hand: two fingers pinching, or one (or the mouse) dragging. */
type ViewGesture =
  | { kind: "pinch"; ids: [number, number]; from: View; start: [Spot, Spot] }
  | { kind: "pan"; id: number; from: View; start: Spot };

/** A finger down on the line tool, not handed on yet – a second may come. */
type Waiting = {
  pointer: number;
  at: number;
  x: number;
  y: number;
  event: PointerEvent<HTMLElement>;
};

/**
 * The stage's pointers: which go to the tool, which move the view – two
 * fingers, a drag with the space bar or the wheel's button held, fingers
 * where a stylus draws – and which are a palm, left out. On touch a loupe
 * shows what the finger covers.
 */
export const useStagePointer = ({
  tool,
  stage,
  zoom,
  zoomed,
  move,
  line,
  pen,
}: {
  tool: Tool;
  stage: RefObject<HTMLElement | null>;
  zoom: { latest: RefObject<View>; set: (next: View) => void };
  zoomed: boolean;
  move: ReturnType<typeof useMove>;
  line: ReturnType<typeof useLine>;
  /** The pen and the eraser. */
  pen: ReturnType<typeof usePen>;
}) => {
  const loupe = useRef<LoupeHandle>(null);
  // Fingers on the stage, a stylus seen, the view moved by hand.
  const touches = useRef(new Map<number, Spot>());
  const stylus = useRef(false);
  const viewing = useRef<ViewGesture | null>(null);
  const ignored = useRef(new Set<number>());
  const waiting = useRef<Waiting | null>(null);
  const toolAt = useRef(0);
  const spaceHeld = useRef(false);
  const [loupeOn, setLoupeOn] = useState(false);

  const inStage = (clientX: number, clientY: number): Spot => {
    const rect = stage.current?.getBoundingClientRect();
    return rect ? onStage({ clientX, clientY }, rect) : [0, 0];
  };

  /** The loupe over a finger at a client point – over the page, anywhere. */
  const showLoupe = (event: { clientX: number; clientY: number }) => {
    const own = stage.current?.getBoundingClientRect();
    if (!own?.width) return;
    loupe.current?.show({
      clientX: event.clientX,
      clientY: event.clientY,
      x: event.clientX - own.left,
      y: event.clientY - own.top,
      side: own.width,
    });
  };
  const hideLoupe = () => loupe.current?.hide();

  const drawsLine = tool === "line" || tool === "points";

  /** What the tool does with a pointer put down – one at a time. */
  const toolDown = (event: PointerEvent<HTMLElement>) => {
    toolAt.current = event.timeStamp;
    if (tool === "move") {
      move.down(event);
      return;
    }
    if (drawsLine) {
      line.down(event);
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer knows – it draws all the same.
    }
    pen.start(event);
  };

  const toolMove = (event: PointerEvent<HTMLElement>) => {
    if (tool === "move") move.move(event);
    else if (drawsLine) line.move(event);
    else pen.move(event);
  };

  const toolUp = (event: PointerEvent<HTMLElement>) => {
    if (tool === "move") move.up(event);
    else if (drawsLine) line.up();
    else pen.end(event);
  };

  /** Whatever the tool was at stops – two fingers took over. */
  const abortTool = () => {
    pen.drop();
    waiting.current = null;
    line.cancel();
    move.cancel();
  };

  /** A finger held on the line tool goes to it now. */
  const handOn = () => {
    const held = waiting.current;
    waiting.current = null;
    if (held) toolDown(held.event);
  };

  const startPinch = () => {
    const ids = [...touches.current.keys()].slice(0, 2) as [number, number];
    const [a, b] = ids.map((id) => {
      const [x, y] = touches.current.get(id) ?? [0, 0];
      return inStage(x, y);
    });
    viewing.current = {
      kind: "pinch",
      ids,
      from: zoom.latest.current,
      start: [a, b],
    };
    hideLoupe();
  };

  const startPan = (event: PointerEvent<HTMLElement>) => {
    viewing.current = {
      kind: "pan",
      id: event.pointerId,
      from: zoom.latest.current,
      start: inStage(event.clientX, event.clientY),
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Moved all the same.
    }
    if (stage.current) stage.current.style.cursor = "grabbing";
  };

  const moveView = (event: PointerEvent<HTMLElement>) => {
    const g = viewing.current;
    if (!g) return;
    if (g.kind === "pinch") {
      const [a, b] = g.ids.map((id) => touches.current.get(id));
      if (!(a && b)) return;
      zoom.set(pinched(g.from, g.start, [inStage(...a), inStage(...b)]));
      return;
    }
    if (g.id !== event.pointerId) return;
    const [x, y] = inStage(event.clientX, event.clientY);
    zoom.set(movedBy(g.from, x - g.start[0], y - g.start[1]));
  };

  const onDown = (event: PointerEvent<HTMLElement>) => {
    const touch = event.pointerType === "touch";
    if (event.pointerType === "pen") stylus.current = true;
    if (touch) {
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
      if (!loupeOn) setLoupeOn(true);
    }
    // Moving the view by hand: the wheel's button or the space bar held –
    // or, where a stylus draws, a finger.
    if (!touch && (event.button === 1 || spaceHeld.current)) {
      event.preventDefault();
      startPan(event);
      return;
    }
    if (touch && stylus.current) {
      if (touches.current.size >= 2) startPinch();
      else if (zoomed) startPan(event);
      return;
    }
    if (touch && touches.current.size === 2 && !viewing.current) {
      // Two fingers on what is selected turn and size it; elsewhere they zoom.
      if (tool === "move") {
        move.down(event);
        if (move.pinching()) return;
        move.cancel();
        startPinch();
        return;
      }
      const soon =
        waiting.current !== null ||
        event.timeStamp - toolAt.current < PINCH_SOON;
      if (soon) {
        abortTool();
        startPinch();
        return;
      }
      // Well into a line: a palm – left out.
      ignored.current.add(event.pointerId);
      return;
    }
    if (touch && touches.current.size > 2) {
      ignored.current.add(event.pointerId);
      return;
    }
    if (viewing.current) return;
    if (touch) showLoupe(event);
    // A finger on the line tool waits a moment – a second may come.
    if (touch && drawsLine) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Waited for all the same.
      }
      event.persist?.();
      waiting.current = {
        pointer: event.pointerId,
        at: event.timeStamp,
        x: event.clientX,
        y: event.clientY,
        event,
      };
      toolAt.current = event.timeStamp;
      return;
    }
    toolDown(event);
  };

  const onMove = (event: PointerEvent<HTMLElement>) => {
    const touch = event.pointerType === "touch";
    if (touch && touches.current.has(event.pointerId)) {
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
    }
    if (viewing.current) {
      moveView(event);
      return;
    }
    if (ignored.current.has(event.pointerId)) return;
    if (touch && stylus.current) return;
    const held = waiting.current;
    if (held && held.pointer === event.pointerId) {
      showLoupe(event);
      const far = Math.hypot(event.clientX - held.x, event.clientY - held.y);
      if (far < HOLD.px && event.timeStamp - held.at < HOLD.ms) return;
      handOn();
    }
    toolMove(event);
    // After the tool: the loupe shows what it just drew.
    if (touch && (pen.busy() || tool !== "pen")) showLoupe(event);
  };

  const onUp = (event: PointerEvent<HTMLElement>) => {
    touches.current.delete(event.pointerId);
    const g = viewing.current;
    if (g) {
      const mine =
        g.kind === "pinch"
          ? g.ids.includes(event.pointerId)
          : g.id === event.pointerId;
      if (mine) {
        viewing.current = null;
        if (stage.current) {
          stage.current.style.cursor = spaceHeld.current ? "grab" : "";
        }
      }
      return;
    }
    if (ignored.current.delete(event.pointerId)) return;
    const held = waiting.current;
    if (held && held.pointer === event.pointerId) handOn();
    toolUp(event);
    hideLoupe();
  };

  const onLeave = () => {
    if (tool === "move") move.leave();
    else if (drawsLine) line.leave();
  };

  return { onDown, onMove, onUp, onLeave, loupe, loupeOn, spaceHeld };
};
