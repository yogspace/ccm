import { type RefObject, useEffect, useRef } from "react";
import { store, type Tool } from "../store";
import type { DrawingModel } from "./use-drawing";
import type { useLine } from "./use-line";
import { NUDGE, type useMove } from "./use-move";

/** Whether a key goes to a field – then it is the field's, not a tool's. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest("input, textarea, select, [contenteditable]"));

/**
 * The editor's keys, while not in a field: ⌘Z / Ctrl+Z a step back, with ⇧
 * (or Ctrl+Y) forward again; P or B the pen, L the line, E the eraser, V
 * moving, A a line's points – ⌘A all of it. ⌘+ and ⌘− zoom, ⌘0 shows the
 * whole area; the space bar held, a drag moves it. With something selected:
 * Escape lets go, Delete removes it, the arrows move it (⇧ further), ⌘D a
 * copy, ⌘C/⌘X/⌘V. A line being drawn: Enter or Escape ends it, ⌫ takes its
 * last point. Editing points: Delete takes the picked one, Escape or Enter
 * is done.
 *
 * The drawing area lies on a page: the space bar, ⌘A and zooming are the
 * area's only while the pointer is over it (`over`) – else they scroll,
 * select and zoom the page as ever.
 */
export const useKeys = ({
  tool,
  stage,
  over,
  spaceHeld,
  drawing,
  move,
  line,
  zoom,
  chooseTool,
  editPoints,
  leavePoints,
}: {
  tool: Tool;
  stage: RefObject<HTMLElement | null>;
  /** The pointer is over the drawing area. */
  over: RefObject<boolean>;
  /** The space bar is held – a drag moves the view (use-stage-pointer.ts). */
  spaceHeld: RefObject<boolean>;
  drawing: DrawingModel;
  move: ReturnType<typeof useMove>;
  line: ReturnType<typeof useLine>;
  zoom: { zoomBy: (factor: number) => void; reset: () => void };
  chooseTool: (tool: Tool) => void;
  /** The one anchored line selected, edited – if there is one. */
  editPoints: () => void;
  leavePoints: (stroke: number | null) => void;
}) => {
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event) => {
    // In a field, or a dialog open over the page: the keys are theirs.
    if (typing(event.target) || store.dialogs > 0) return;
    const key = event.key.toLowerCase();
    const chosen = tool === "move" && drawing.live.current.selection;
    const removes = key === "delete" || key === "backspace";
    const ends = key === "enter" || key === "escape";
    if (event.metaKey || event.ctrlKey) {
      if (event.altKey) return;
      if (key === "z") {
        if (event.shiftKey) drawing.redo();
        else drawing.undo();
      } else if (key === "y") drawing.redo();
      else if ((key === "+" || key === "=") && over.current) zoom.zoomBy(1.5);
      else if (key === "-" && over.current) zoom.zoomBy(1 / 1.5);
      else if (key === "0" && over.current) zoom.reset();
      else if (key === "a" && (over.current || chosen)) {
        chooseTool("move");
        move.all();
      } else if (key === "d" && chosen) move.duplicate();
      else if (key === "c" && chosen) move.copy();
      else if (key === "x" && chosen) move.cut();
      else if (key === "v" && move.paste()) chooseTool("move");
      else return;
      event.preventDefault();
      return;
    }
    if (event.altKey) return;
    if (key === " " && over.current) {
      spaceHeld.current = true;
      if (stage.current) stage.current.style.cursor = "grab";
    } else if (key === "p" || key === "b") chooseTool("pen");
    else if (key === "l") chooseTool("line");
    else if (key === "e") chooseTool("eraser");
    else if (key === "v") chooseTool("move");
    else if (key === "a") editPoints();
    else if (tool === "line" && line.active && ends) line.finish();
    else if (tool === "line" && line.active && removes) line.back();
    else if (tool === "points" && ends) leavePoints(line.editing);
    else if (tool === "points" && line.anchor !== null && removes) {
      line.removePoint();
    } else if (chosen && key === "escape") move.clear();
    else if (chosen && removes) drawing.removeSelected();
    else if (chosen && key.startsWith("arrow")) {
      const by = event.shiftKey ? NUDGE.big : NUDGE.small;
      const way = key.slice(5);
      move.nudge(
        way === "left" ? -by : way === "right" ? by : 0,
        way === "up" ? -by : way === "down" ? by : 0
      );
    } else return;
    event.preventDefault();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keys.current(event);
    const onUp = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      spaceHeld.current = false;
      if (stage.current) stage.current.style.cursor = "";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [stage, spaceHeld]);
};
