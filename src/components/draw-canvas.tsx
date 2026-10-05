import {
  Brush,
  FileUp,
  Maximize2,
  Minimize2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { loadSilhouette, type Ring } from "../geometry/outline";
import type { Unit } from "../units";
import DrawGrid from "./draw-grid";

type Point = { x: number; y: number };

type Props = {
  /** Finale Ausstecher-Kontur, normiert auf 0…1, als Overlay über der Zeichnung. */
  outline: Ring[];
  /** Nach jedem Strich, Import, Rückgängig oder Löschen. */
  onChange: (canvas: HTMLCanvasElement) => void;
  onError: (error: unknown) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Form aus einem geteilten Link, wird beim Start einmal gemalt. */
  initialRings: Ring[];
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

const DrawCanvas = ({
  outline,
  onChange,
  onError,
  expanded,
  onToggleExpanded,
  initialRings,
  mmPerCanvas,
  unit,
}: Props) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pen = useRef<{ smoothed: Point; mid: Point } | null>(null);
  const history = useRef<ImageData[]>([]);
  const [brush, setBrush] = useState(24);
  const [empty, setEmpty] = useState(initialRings.length === 0);
  const [canUndo, setCanUndo] = useState(false);
  const [dragging, setDragging] = useState(false);

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setEmpty(false);
    onChange(canvas);
  };

  const snapshot = () => {
    const ctx = context();
    if (!ctx) return;
    history.current.push(ctx.getImageData(0, 0, RES, RES));
    if (history.current.length > HISTORY) history.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const ctx = context();
    const previous = history.current.pop();
    if (!ctx || !previous) return;
    ctx.putImageData(previous, 0, 0);
    setCanUndo(history.current.length > 0);
    commit();
    // Leer ist die Fläche, wenn kein Pixel mehr deckt.
    setEmpty(!previous.data.some((value, i) => i % 4 === 3 && value > 0));
  };

  const clear = () => {
    const ctx = context();
    if (!ctx) return;
    snapshot();
    ctx.clearRect(0, 0, RES, RES);
    commit();
    setEmpty(true);
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
      commit();
    } catch (error) {
      onError(error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Start
  useEffect(() => {
    const ctx = context();
    if (!ctx || initialRings.length === 0) return;
    const path = new Path2D();
    for (const ring of initialRings) {
      for (const [i, [x, y]] of ring.entries()) {
        if (i === 0) path.moveTo(x * RES, y * RES);
        else path.lineTo(x * RES, y * RES);
      }
      path.closePath();
    }
    // Als Strich innen entlang der Kontur statt als Fläche: sieht aus wie
    // gezeichnet, und die Außenkante bleibt exakt die geteilte Kontur.
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = brush * 2;
    ctx.lineJoin = "round";
    ctx.stroke(path);
    ctx.restore();
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
  ): Point => ({
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
    const point = toCanvas(event, event.currentTarget.getBoundingClientRect());
    pen.current = { smoothed: point, mid: point };
    draw((ctx) => {
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, point.y);
    });
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
    }
  };

  const end = () => {
    const state = pen.current;
    if (!state) return;
    draw((ctx) => {
      ctx.moveTo(state.mid.x, state.mid.y);
      ctx.lineTo(state.smoothed.x, state.smoothed.y);
    });
    pen.current = null;
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
        <button
          aria-label={t(expanded ? "draw.shrink" : "draw.expand")}
          aria-pressed={expanded}
          className="icon overlay"
          onClick={onToggleExpanded}
          title={t(expanded ? "draw.shrink" : "draw.expand")}
          type="button"
        >
          {expanded ? (
            <Minimize2 aria-hidden size={18} />
          ) : (
            <Maximize2 aria-hidden size={18} />
          )}
        </button>
        {empty && !dragging && (
          <div className="stage-hint">
            <Brush aria-hidden size={28} strokeWidth={1.5} />
            <strong>{t("draw.hint")}</strong>
            <span>{t("draw.hintSub")}</span>
          </div>
        )}
        {dragging && (
          <div className="stage-hint drop">
            <FileUp aria-hidden size={28} strokeWidth={1.5} />
            <strong>{t("draw.drop")}</strong>
          </div>
        )}
      </div>

      <div className="toolbar">
        <label className="brush">
          <span
            aria-hidden
            className="brush-dot"
            style={
              { "--dot": `${4 + ((brush - 6) / 58) * 16}px` } as CSSProperties
            }
          />
          <span className="sr-only">{t("draw.brush")}</span>
          <input
            max={64}
            min={6}
            onChange={(event) => setBrush(Number(event.target.value))}
            style={
              { "--fill": `${((brush - 6) / 58) * 100}%` } as CSSProperties
            }
            type="range"
            value={brush}
          />
        </label>
        <div className="actions">
          <button
            aria-label={t("draw.undo")}
            className="icon"
            disabled={!canUndo}
            onClick={undo}
            title={t("draw.undo")}
            type="button"
          >
            <Undo2 aria-hidden size={16} />
          </button>
          <button
            aria-label={t("draw.clear")}
            className="icon"
            disabled={empty}
            onClick={clear}
            title={t("draw.clear")}
            type="button"
          >
            <Trash2 aria-hidden size={16} />
          </button>
          <button onClick={() => inputRef.current?.click()} type="button">
            <FileUp aria-hidden size={16} />
            {t("draw.upload")}
          </button>
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
