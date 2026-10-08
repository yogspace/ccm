import { type PointerEvent, useEffect, useRef, useState } from "react";
import {
  type Box,
  detachErasers,
  mergeSelections,
  objectAt,
  objectsWithin,
  DRAW_RES as RES,
  type Selection,
  selectionBox,
  type Transform,
  transformDrawing,
} from "../drawing";
import type { Point } from "../geometry/outline";
import { store } from "../store";
import type { Drawing } from "../url-state";
import {
  angleOf,
  boxBetween,
  center,
  clampScale,
  corners,
  distance,
  type Frame,
  frameOf,
  inside,
  middle,
  snapAngle,
  toPoint,
} from "./gesture-math";
import type { DrawingModel, Snapshot } from "./use-drawing";

/** This close (CSS pixels) you must hit an object or a handle. */
const HIT = 12;

/** A move gesture in progress; the transform always starts from `start`. */
type Gesture = {
  /** `scale` at the corners rotates and scales at once. */
  kind: "drag" | "scale" | "pinch";
  start: Drawing;
  selection: Selection;
  box: Box;
  origin: Point;
  pinch?: { distance: number; mid: Point; angle: number };
  before: Snapshot;
  changed: boolean;
};

const tolerance = (rect: DOMRect) => (HIT * RES) / rect.width;

/**
 * The move tool: a tap selects an object (with shift one more), a box
 * dragged over empty space selects what lies inside it. The selection
 * moves when dragged, rotates and scales at its corners, with two fingers
 * or the wheel. Every finished gesture is one undo step.
 * `gestureFrame`: the selection's frame turned along while a gesture is on;
 * `marqueeBox`: the box being dragged.
 */
export const useMove = ({
  canvasRef,
  drawing,
  live,
  selection,
  box,
  capture,
  remember,
  commit,
  repaint,
  select,
  reframe,
}: DrawingModel) => {
  const gesture = useRef<Gesture | null>(null);
  /** Box selection: start point and – with shift – the selection before it. */
  const marquee = useRef<{ origin: Point; base: Selection | null } | null>(
    null
  );
  const [marqueeBox, setMarqueeBox] = useState<Box | null>(null);
  const [gestureFrame, setGestureFrame] = useState<Frame | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const wheel = useRef<{ before: Snapshot; timer: number } | null>(null);

  // The wheel scales the selection; React attaches wheel listeners passively,
  // so it sits directly on the element, keeping the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const { selection: chosen, box: frame } = live.current;
      if (store.tool !== "move" || !chosen || !frame) return;
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
      reframe(chosen);
      // Once the wheel rests: one undo step, then recompute.
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

  /** Another tool: no box being dragged. */
  const cancel = () => {
    marquee.current = null;
    setMarqueeBox(null);
  };

  const grab = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toPoint(event, rect);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;

    // A second finger cancels the box.
    if (marquee.current && pointers.current.size > 1) {
      cancel();
      return;
    }

    // Second finger: the two-finger gesture scales, rotates and moves.
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
      // Corners rotate and scale, inside moves – the selection stays as it is
      // (even if it touches something).
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
    if (!found) {
      // Empty space: drag a box – with shift what it catches is added,
      // otherwise it replaces the selection.
      if (!event.shiftKey) select(null);
      marquee.current = {
        origin: point,
        base: event.shiftKey ? selection : null,
      };
      setMarqueeBox(boxBetween(point, point));
      return;
    }
    // With shift the object is added to the selection.
    const wanted =
      event.shiftKey && selection ? mergeSelections(selection, found) : found;
    // Erasers that also affect other objects are duplicated for this one.
    const detached = detachErasers(drawing.current, wanted);
    drawing.current = detached.drawing;
    const hit = detached.selection;
    select(hit);
    const hitBox = selectionBox(drawing.current, hit);
    if (hitBox) {
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

    const area = marquee.current;
    if (area) {
      setMarqueeBox(boxBetween(area.origin, point));
      return;
    }

    // Without a gesture only adjust the pointer: handle, corner, object – or a
    // crosshair where a box can be dragged.
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
            : "crosshair";
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
      const pivot = center(current.box);
      const from = Math.max(distance(current.origin, pivot), 1);
      transform = {
        scale: clampScale(current.box, distance(point, pivot) / from),
        angle: snapAngle(
          angleOf(pivot, point) - angleOf(pivot, current.origin),
          event.shiftKey
        ),
        cx: pivot[0],
        cy: pivot[1],
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

    // Releasing the box selects everything entirely inside it.
    const area = marquee.current;
    if (area) {
      cancel();
      const point = toPoint(event, event.currentTarget.getBoundingClientRect());
      const within = objectsWithin(
        drawing.current,
        boxBetween(area.origin, point)
      );
      const wanted =
        area.base && within
          ? mergeSelections(area.base, within)
          : (within ?? area.base);
      if (!wanted) return;
      const detached = detachErasers(drawing.current, wanted);
      drawing.current = detached.drawing;
      select(detached.selection);
      return;
    }

    const current = gesture.current;
    if (!current) return;
    // One finger stays down: keep moving from here.
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
    // The selection stays for further corrections; what touches now belongs
    // together on the next tap.
    select(current.selection);
  };

  return { grab, drag, release, cancel, marqueeBox, gestureFrame };
};
