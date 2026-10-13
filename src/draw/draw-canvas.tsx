import { FileUp, Spline, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type DragEvent,
  memo,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { ANCHOR } from "../bezier";
import { cn } from "../cn";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import {
  cookieInIconButton,
  cookieInStageHint,
  stage,
  stageHint,
} from "../components/styles";
import { anchoredAt, DRAW_RES as RES } from "../drawing";
import type { Point } from "../geometry/outline";
import { store, type Tool, useMmPerCanvas } from "../store";
import BrushOptions from "./brush-options";
import DrawActions from "./draw-actions";
import DrawGrid from "./draw-grid";
import { CuttingLine, MarqueeBox, SelectionFrame } from "./draw-marks";
import DrawTemplates from "./draw-templates";
import { distance, frameOf, toPoint } from "./gesture-math";
import LineMarks from "./line-marks";
import ShapeHead from "./shape-head";
import ToolPicker from "./tool-picker";
import { useAreaFit } from "./use-area-fit";
import { useDrawing } from "./use-drawing";
import { useLine } from "./use-line";
import { useMove } from "./use-move";
import { usePen } from "./use-pen";

/** Two presses this soon (ms) and near (CSS px) are a double click. */
const TWICE = { ms: 400, px: 8 };
/** This close (CSS px) a double click must hit a line. */
const HIT = 12;

/** A button on the drawing area, at a spot in drawing-area pixels. */
const onStage = ([x, y]: Point, dx: string, dy: string) => ({
  left: `clamp(1.2rem, calc(${(x / RES) * 100}% + ${dx}), calc(100% - 1.2rem))`,
  top: `clamp(1.2rem, calc(${(y / RES) * 100}% + ${dy}), calc(100% - 1.2rem))`,
});

/**
 * Drawing area with tools and templates. Tool, brush size, unit and the final
 * contour come from the store, every change of the drawing goes back there
 * (use-drawing.ts). Drawing (use-pen.ts), moving (use-move.ts), selection
 * and undo stay local here.
 */
const DrawCanvas = () => {
  const { t } = useTranslation();
  const { tool, brush, ink, unit, cutter } = useSnapshot(store);
  const mmPerCanvas = useMmPerCanvas();
  const areaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const brushCursorRef = useRef<HTMLSpanElement>(null);
  const drawing = useDrawing();
  const { canvasRef, selection, box, empty } = drawing;
  const pen = usePen(drawing);
  const moving = useMove(drawing);
  const line = useLine(drawing, {
    tool,
    onLeave: (stroke) => leavePoints(stroke),
  });
  const [dragging, setDragging] = useState(false);
  const mode =
    tool === "move"
      ? "move"
      : tool === "line" || tool === "points"
        ? "line"
        : "draw";
  // No hover: a finger – the hints say tap, not click.
  const touch = window.matchMedia("(hover: none)").matches;
  useAreaFit({ area: areaRef, grid: gridRef, stage: stageRef });

  // ---------- Brush preview ----------

  const hideBrush = () => {
    if (brushCursorRef.current) brushCursorRef.current.style.opacity = "0";
  };

  const showBrush = (event: PointerEvent<HTMLDivElement>) => {
    const cursor = brushCursorRef.current;
    const area = stageRef.current;
    if (!cursor || !area) return;
    // Only with mouse or pen – touch has no hover.
    if (mode !== "draw" || event.pointerType === "touch") {
      hideBrush();
      return;
    }
    const rect = area.getBoundingClientRect();
    const size = (brush * rect.width) / RES;
    cursor.style.width = cursor.style.height = `${size}px`;
    cursor.style.transform = `translate(${event.clientX - rect.left - size / 2}px, ${event.clientY - rect.top - size / 2}px)`;
    cursor.style.opacity = "1";
  };

  // Another tool ends what the one before was at – a line being drawn stays
  // as far as it got.
  const chooseTool = (next: Tool) => {
    store.tool = next;
    moving.cancel();
    drawing.select(null);
    hideBrush();
    if (canvasRef.current) canvasRef.current.style.cursor = "";
  };

  /** A line's points are edited – moving's own, with that line. */
  const editPoints = (stroke: number) => {
    chooseTool("points");
    line.edit(stroke);
  };

  /** Done with the points: back to moving, the line picked. */
  const leavePoints = (stroke: number | null) => {
    chooseTool("move");
    if (stroke !== null) drawing.select({ strokes: [stroke], rings: [] });
  };

  /** The last press with the move tool – one more soon and near it is a double click. */
  const lastPress = useRef({ time: -Infinity, point: [0, 0] as Point });
  /** Moving – a double click on an anchored line edits its points. */
  const grab = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toPoint(event, rect);
    const before = lastPress.current;
    lastPress.current = { time: event.timeStamp, point };
    const twice =
      event.timeStamp - before.time < TWICE.ms &&
      (distance(point, before.point) * rect.width) / RES < TWICE.px;
    const index = twice
      ? anchoredAt(drawing.drawing.current, point, (HIT * RES) / rect.width)
      : null;
    if (index !== null) editPoints(index);
    else moving.grab(event);
  };

  // The one anchored line in the selection – its points can be edited.
  const anchoredLines =
    tool === "move" && selection
      ? selection.strokes.filter((index) => {
          const stroke = drawing.drawing.current.strokes[index];
          return stroke?.anchors && !stroke.erase;
        })
      : [];
  const pickedLine = anchoredLines.length === 1 ? anchoredLines[0] : null;
  // The point picked on the line being edited – where to take it away.
  const editedAnchors =
    line.editing !== null
      ? drawing.drawing.current.strokes[line.editing]?.anchors
      : undefined;
  const pickedPoint: Point | null =
    editedAnchors && line.anchor !== null
      ? [
          editedAnchors[line.anchor * ANCHOR],
          editedAnchors[line.anchor * ANCHOR + 1],
        ]
      : null;
  // Stable for the memoised tool picker, yet always calls the current version.
  const chooseToolRef = useRef(chooseTool);
  chooseToolRef.current = chooseTool;
  const onChooseTool = useCallback(
    (next: Tool) => chooseToolRef.current(next),
    []
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) drawing.importFile(file);
  };

  const frame = moving.gestureFrame ?? (box ? frameOf(box) : null);

  return (
    // Container for area and bars: its size decides whether the bars sit
    // beside or below the area (use-area-fit.ts). Desktop: the area becomes
    // the largest square that fits its card, at window height – enlarged as
    // high as the window.
    <div
      className="mx-auto flex w-(--stage-size) flex-col @container/draw md:w-full md:items-center md:@container-size md:not-in-data-expanded:min-h-104 md:not-in-data-expanded:flex-1 md:in-data-expanded:h-[clamp(30rem,100dvh-3rem,68rem)]"
      ref={areaRef}
    >
      {/* One grid for head, area and bars – the head as wide as the area.
          Default: everything below the area – tools | brush size | undo &
          clear, below that the templates; narrow:
          tools and actions on top, the brush size full width below. Unless
          the card is clearly taller than wide, the bars sit beside the area
          and it gets larger: tools on the left (drawing on top, undo & clear
          at the bottom), templates stacked on the right, only the brush size
          below – below the area the bars need a good 4× as much height as
          they need width beside it, so it pays off from 0.88 on. Desktop
          only (also enlarged): only there does the container know its
          height. There it is as wide as the area (--s): the card's room
          minus what the bars beside (--chrome-w) and below (--chrome-h)
          need, both measured – the fallbacks only apply until the first
          measurement. */}
      <div
        className="grid w-(--s,auto) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 [grid-template-areas:'head_head_head'_'stage_stage_stage'_'tools_options_actions'_'templates_templates_templates'] md:[--s:max(12rem,min(60rem,100cqw-var(--chrome-w,0px),100cqh-var(--chrome-h,8rem)))] @max-[34rem]/draw:gap-x-3 @max-[34rem]/draw:[grid-template-areas:'head_head_head'_'stage_stage_stage'_'tools_._actions'_'options_options_options'_'templates_templates_templates'] beside:w-auto beside:grid-cols-[--spacing(12)_var(--s)_--spacing(12)] beside:grid-rows-[auto_var(--s)_auto] beside:gap-x-3 beside:gap-y-4 beside:[grid-template-areas:'._head_.'_'tools_stage_templates'_'._options_.']"
        ref={gridRef}
      >
        <ShapeHead />
        {/* Always square – otherwise the drawing area distorts everything on
            it. Anchors the error popup. */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a pure drop zone, importing also works via the button */}
        <div
          className={cn(
            stage,
            "group/stage aspect-square w-full min-w-0 [grid-area:stage] [anchor-name:--drawing]",
            dragging && "bg-accent-soft transform-[scale(0.985)]"
          )}
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
          {/* With a mouse the brush preview shows where it paints – the arrow
              would be doubled. */}
          <canvas
            className={cn(
              "absolute inset-0 size-full cursor-crosshair touch-none",
              mode === "draw" && "[@media(hover:hover)]:cursor-none",
              (mode === "move" || tool === "points") && "cursor-default"
            )}
            height={RES}
            onPointerCancel={
              { draw: pen.end, move: moving.release, line: line.up }[mode]
            }
            onPointerDown={
              { draw: pen.start, move: grab, line: line.down }[mode]
            }
            onPointerLeave={mode === "line" ? line.leave : undefined}
            onPointerMove={
              { draw: pen.move, move: moving.drag, line: line.move }[mode]
            }
            onPointerUp={
              { draw: pen.end, move: moving.release, line: line.up }[mode]
            }
            ref={canvasRef}
            width={RES}
          />
          {cutter.outline.length > 0 && (
            <CuttingLine outline={cutter.outline} />
          )}
          {mode === "line" && (
            <LineMarks lines={line.lines} marks={line.marks} touch={touch} />
          )}
          {/* With the line tool, a line on how it goes. */}
          {mode === "line" && (
            <p className="pointer-events-none absolute bottom-2 left-1/2 z-2 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 rounded-full bg-paper/90 px-3 py-1 text-center text-small text-muted">
              {tool === "line"
                ? t(touch ? "draw.lineHintTouch" : "draw.lineHint")
                : t(touch ? "draw.pointsHintTouch" : "draw.pointsHint")}
            </p>
          )}
          {/* X at the picked point: takes it away (like Delete). */}
          {tool === "points" && pickedPoint && (
            <Button
              aria-keyshortcuts="Delete"
              aria-label={t("draw.removePoint")}
              className="absolute z-3 -translate-1/2"
              kind="icon"
              onClick={line.removePoint}
              style={onStage(pickedPoint, "22px", "-22px")}
              title={t("draw.removePoint")}
              type="button"
            >
              <CookieIcon
                className={cookieInIconButton}
                icing="#ff5fa8"
                icon={X}
                roll={8}
                size={40}
              />
            </Button>
          )}
          {mode === "move" && frame && <SelectionFrame frame={frame} />}
          {mode === "move" && moving.marqueeBox && (
            <MarqueeBox box={moving.marqueeBox} />
          )}
          {/* X at the selection: removes it (like Delete) */}
          {mode === "move" && box && !moving.gestureFrame && (
            <Button
              aria-label={t("draw.removeSelection")}
              className="absolute z-3 -translate-1/2"
              kind="icon"
              onClick={drawing.removeSelected}
              style={onStage([box.x1, box.y0], "14px", "-14px")}
              title={t("draw.removeSelection")}
              type="button"
            >
              <CookieIcon
                className={cookieInIconButton}
                icing="#ff5fa8"
                icon={X}
                roll={8}
                size={40}
              />
            </Button>
          )}
          {/* Below it, with one anchored line picked: edit its points (or a
              double click on it). */}
          {mode === "move" &&
            box &&
            pickedLine !== null &&
            !moving.gestureFrame && (
              <Button
                aria-label={t("draw.points")}
                className="absolute z-3 -translate-1/2"
                kind="icon"
                onClick={() => editPoints(pickedLine)}
                style={onStage([box.x1, box.y0], "14px", "30px")}
                title={t("draw.points")}
                type="button"
              >
                <CookieIcon
                  className={cookieInIconButton}
                  icing="#ff6a1f"
                  icon={Spline}
                  roll={-8}
                  size={40}
                />
              </Button>
            )}
          {/* Brush preview: a circle at the real brush size that follows the
              pointer (showBrush) */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 left-0 z-2 rounded-full border-[1.5px] border-[rgb(13_16_51/0.55)] bg-[rgb(13_16_51/0.06)] opacity-0 transition-opacity duration-150",
              tool === "eraser" && "border-dashed bg-white/55"
            )}
            ref={brushCursorRef}
          />
          <AnimatePresence>
            {empty && !dragging && !pen.penDown && !line.active && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className={stageHint}
                exit={{ opacity: 0, scale: 0.94 }}
                initial={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <CookieIcon
                  className={cookieInStageHint}
                  kind="heart"
                  size={130}
                />
                <strong className="font-bold text-ink">{t("draw.hint")}</strong>
                <span>{t("draw.hintSub")}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {dragging && (
            <div className={stageHint}>
              <CookieIcon
                className={cookieInStageHint}
                icing="#2a44ff"
                icon={FileUp}
                size={110}
              />
              <strong className="font-bold text-ink">{t("draw.drop")}</strong>
            </div>
          )}
        </div>

        <ToolPicker onChoose={onChooseTool} tool={tool} />
        <BrushOptions
          brush={brush}
          ink={ink}
          inks={tool !== "eraser" && (tool !== "move" || !!selection)}
          onChange={drawing.changeBrush}
          onInk={drawing.changeInk}
          shown={mode !== "move" || !!selection}
        />
        <DrawActions
          canRedo={drawing.canRedo}
          canUndo={drawing.canUndo}
          empty={empty}
          finishable={tool === "points" || line.active}
          onClear={drawing.clear}
          onFinish={
            tool === "line"
              ? line.finish
              : tool === "points"
                ? () => leavePoints(line.editing)
                : null
          }
          onRedo={drawing.redo}
          onUndo={drawing.undo}
        />
        <DrawTemplates
          onImport={drawing.importFile}
          onInsert={drawing.insertPreset}
        />
      </div>
    </div>
  );
};

// No props: re-renders only when something it reads in the store changes.
export default memo(DrawCanvas);
