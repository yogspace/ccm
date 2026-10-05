import { FileUp, Pencil, Trash2, Undo2, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  loadSilhouette,
  type Point,
  type Ring,
  traceOutline,
} from "../geometry/outline";
import type { Unit } from "../units";
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

type Pen = { x: number; y: number };

type Props = {
  /** Finale Ausstecher-Kontur, normiert auf 0…1, als Overlay über der Zeichnung. */
  outline: Ring[];
  /** Nach jedem Strich, Import, Rückgängig oder Löschen – mit der Zeichnung zum Teilen. */
  onChange: (canvas: HTMLCanvasElement, drawing: Drawing) => void;
  onError: (error: unknown) => void;
  /** Zeichnung aus einem geteilten Link, wird beim Start einmal gemalt. */
  initialDrawing: Drawing;
  /** Nach dem Malen melden, damit der Ausstecher aus der Zeichnung entsteht. */
  traceInitial: boolean;
  /** Maßstab fürs Koordinatensystem, `null` solange es keine Form gibt. */
  mmPerCanvas: number | null;
  unit: Unit;
};

/** Auflösung der Zeichenfläche; Striche sind schwarz auf transparent. */
const RES = 1024;
/** Anteil, um den der Strich pro Sample zur echten Stiftposition aufholt. */
const FOLLOW = 0.35;
const HISTORY = 40;
/** Rand um importierte SVGs, damit sie nicht an der Kante kleben. */
const IMPORT_MARGIN = 0.1;

const ringsPath = (rings: Ring[]) => {
  const path = new Path2D();
  for (const ring of rings) {
    for (const [i, [x, y]] of ring.entries()) {
      if (i === 0) path.moveTo(x * RES, y * RES);
      else path.lineTo(x * RES, y * RES);
    }
    path.closePath();
  }
  return path;
};

/**
 * Malt eine gespeicherte Zeichnung: erst die Fläche, dann die Striche – mit
 * denselben Kurven wie beim Zeichnen, damit sie genauso aussieht.
 */
const paint = (ctx: CanvasRenderingContext2D, drawing: Drawing) => {
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (drawing.base.length > 0) {
    const path = ringsPath(drawing.base);
    if (drawing.baseLine === 0) ctx.fill(path, "evenodd");
    else {
      // Alte Links: als Strich innen entlang der Kontur statt als Fläche – sieht
      // aus wie gezeichnet, und die Außenkante bleibt exakt die geteilte Kontur.
      ctx.save();
      ctx.clip(path);
      ctx.lineWidth = drawing.baseLine;
      ctx.stroke(path);
      ctx.restore();
    }
  }
  for (const { width, points } of drawing.strokes) {
    const [first, ...rest] = points;
    if (!first) continue;
    ctx.beginPath();
    ctx.arc(first[0], first[1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    if (rest.length === 0) continue;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    let previous = first;
    for (const point of rest) {
      const mid: Point = [
        (previous[0] + point[0]) / 2,
        (previous[1] + point[1]) / 2,
      ];
      ctx.quadraticCurveTo(previous[0], previous[1], mid[0], mid[1]);
      previous = point;
    }
    ctx.lineTo(previous[0], previous[1]);
    ctx.stroke();
  }
};

const DrawCanvas = ({
  outline,
  onChange,
  onError,
  initialDrawing,
  traceInitial,
  mmPerCanvas,
  unit,
}: Props) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pen = useRef<{ smoothed: Pen; mid: Pen; points: Point[] } | null>(null);
  /** Was gemalt wurde, als Vektoren – das wird geteilt. */
  const drawing = useRef<Drawing>(initialDrawing);
  const history = useRef<{ image: ImageData; drawing: Drawing }[]>([]);
  const [brush, setBrush] = useState(24);
  const [empty, setEmpty] = useState(isEmptyDrawing(initialDrawing));
  const [canUndo, setCanUndo] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Der Hinweis verschwindet schon beim Ansetzen des Stifts, nicht erst danach.
  const [penDown, setPenDown] = useState(false);

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setEmpty(isEmptyDrawing(drawing.current));
    onChange(canvas, drawing.current);
  };

  const snapshot = () => {
    const ctx = context();
    if (!ctx) return;
    history.current.push({
      image: ctx.getImageData(0, 0, RES, RES),
      drawing: drawing.current,
    });
    if (history.current.length > HISTORY) history.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const ctx = context();
    const previous = history.current.pop();
    if (!ctx || !previous) return;
    ctx.putImageData(previous.image, 0, 0);
    drawing.current = previous.drawing;
    setCanUndo(history.current.length > 0);
    commit();
  };

  const clear = () => {
    const ctx = context();
    if (!ctx) return;
    snapshot();
    ctx.clearRect(0, 0, RES, RES);
    drawing.current = emptyDrawing;
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
      commit();
    } catch (error) {
      onError(error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Start
  useEffect(() => {
    const ctx = context();
    if (!ctx || isEmptyDrawing(initialDrawing)) return;
    paint(ctx, initialDrawing);
    if (traceInitial) commit();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toCanvas = (
    { clientX, clientY }: { clientX: number; clientY: number },
    rect: DOMRect
  ): Pen => ({
    x: ((clientX - rect.left) / rect.width) * RES,
    y: ((clientY - rect.top) / rect.height) * RES,
  });

  const draw = (path: (ctx: CanvasRenderingContext2D) => void) => {
    const ctx = context();
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
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
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(point.x, point.y, brush / 2, 0, Math.PI * 2);
    ctx.fill();
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
    drawing.current = {
      ...drawing.current,
      strokes: [...drawing.current.strokes, stroke],
    };
    commit();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) importFile(file);
  };

  return (
    <div className="draw-area">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: reine Drop-Fläche, Import geht auch über den Button */}
      <div
        className="stage paper"
        data-dragging={dragging || undefined}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        <DrawGrid mmPerCanvas={mmPerCanvas} unit={unit} />
        <canvas
          className="drawing"
          height={RES}
          onPointerCancel={end}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
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

      <div className="toolbar">
        <div className="brush">
          <CookieIcon icing="#ffc31f" icon={Pencil} roll={118} size={50} />
          {/* Vorschau der Strichstärke */}
          <span
            aria-hidden
            className="brush-dot"
            style={
              { "--dot": `${4 + ((brush - 6) / 58) * 16}px` } as CSSProperties
            }
          />
          <CookieSlider
            label={t("draw.brush")}
            max={64}
            min={6}
            onChange={setBrush}
            step={1}
            value={brush}
          />
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
            aria-label={t("draw.clear")}
            className="icon"
            disabled={empty}
            onClick={clear}
            title={t("draw.clear")}
            type="button"
          >
            <CookieIcon icing="#ff5fa8" icon={Trash2} roll={9} size={52} />
          </Button>
          <Button onClick={() => inputRef.current?.click()} type="button">
            <CookieIcon icing="#2a44ff" icon={Upload} roll={10} size={58} />
            {t("draw.upload")}
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

export default DrawCanvas;
