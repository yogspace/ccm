import { Brush, Eraser } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { RES } from "../geometry/raster";

type Point = { x: number; y: number };

type Props = {
  /** Wird nach jedem Strich mit dem aktuellen Bild aufgerufen. */
  onChange: (canvas: HTMLCanvasElement | null) => void;
};

/** Anteil, um den der Strich pro Sample zur echten Stiftposition aufholt. */
const FOLLOW = 0.35;

const DrawPad = ({ onChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pen = useRef<{ smoothed: Point; mid: Point } | null>(null);
  const [brush, setBrush] = useState(10);
  const [empty, setEmpty] = useState(true);

  const context = () => canvasRef.current?.getContext("2d") ?? null;

  const clear = () => {
    const ctx = context();
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, RES, RES);
    setEmpty(true);
    onChange(null);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: nur initial leeren
  useEffect(clear, []);

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
    event.currentTarget.setPointerCapture(event.pointerId);
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
    setEmpty(false);
    onChange(canvasRef.current);
  };

  return (
    <div className="drawpad">
      <canvas
        height={RES}
        onPointerCancel={end}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        ref={canvasRef}
        width={RES}
      />
      <div className="row">
        <label>
          <Brush aria-hidden size={16} />
          Pinsel
          <input
            max={40}
            min={2}
            onChange={(event) => setBrush(Number(event.target.value))}
            type="range"
            value={brush}
          />
        </label>
        <button disabled={empty} onClick={clear} type="button">
          <Eraser aria-hidden size={16} />
          Leeren
        </button>
      </div>
      <p className="hint">
        Umriss zeichnen – geschlossene Linien werden automatisch gefüllt.
      </p>
    </div>
  );
};

export default DrawPad;
