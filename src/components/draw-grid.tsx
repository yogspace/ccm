import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import { numberFormat, type Unit } from "../units";

type Props = {
  /** How many mm the drawing area's width is in the finished cutter. */
  mmPerCanvas: number | null;
  unit: Unit;
};

const MM_PER_INCH = 25.4;
/** Without a shape there is no scale – then a neutral 8×8 grid. */
const FALLBACK_DIVISIONS = 8;
/** Labels too close to the corner would run into the other axis's. */
const LABEL_MARGIN = 0.08;

/** A label at the edge; x at the bottom, y on the left, 0 in the corner. */
const tick =
  "absolute text-tiny leading-none text-[#9a917f] tabular-nums";

/** Rounds to 1, 2 or 5 times a power of ten. */
const niceStep = (raw: number) => {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (
    (fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10) * power
  );
};

/** `index` stays the same when zooming – so lines move instead of being recreated. */
type Tick = { index: number; pos: number; value: number; major: boolean };

/** Ticks from 0 (bottom left corner) to the edge; `pos` from the left or bottom (0…1). */
const buildTicks = (span: number): Tick[] => {
  const step = niceStep(span / 8);
  const minor = step / 2;
  const count = Math.floor(span / minor + 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => ({
    index: i,
    pos: (i * minor) / span,
    value: i * minor,
    major: i % 2 === 0,
  }));
};

/**
 * Coordinate system under the drawing, like at school: origin bottom left,
 * x to the right, y upwards, in the cutter's real dimensions – so you can read
 * off where something is.
 */
const DrawGrid = ({ mmPerCanvas, unit }: Props) => {
  const { i18n } = useTranslation();
  const format = numberFormat(i18n.resolvedLanguage, 2);

  const ticks: Tick[] = mmPerCanvas
    ? buildTicks(unit === "in" ? mmPerCanvas / MM_PER_INCH : mmPerCanvas)
    : Array.from({ length: FALLBACK_DIVISIONS + 1 }, (_, i) => ({
        index: i,
        pos: i / FALLBACK_DIVISIONS,
        value: 0,
        major: true,
      }));
  // The 0 sits once in the corner; nothing too close to the corners.
  const labels = mmPerCanvas
    ? ticks.filter(
        ({ pos, major }) =>
          major && pos > LABEL_MARGIN && pos < 1 - LABEL_MARGIN
      )
    : [];

  return (
    // Clearer while the pointer is on the drawing area (draw-canvas.tsx).
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover/stage:opacity-100"
    >
      <svg
        aria-hidden
        className="block size-full stroke-1"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        {ticks.map(({ index, pos, major }) => (
          <g
            className={major ? "stroke-[#e4dac8]" : "stroke-[#f1ebdf]"}
            key={index}
          >
            <line
              vectorEffect="non-scaling-stroke"
              x1={pos}
              x2={pos}
              y1={0}
              y2={1}
            />
            {/* In SVG y points down – counted from the bottom. */}
            <line
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={1}
              y1={1 - pos}
              y2={1 - pos}
            />
          </g>
        ))}
        {/* Axes: left and bottom edge – twice as thick, half of it is visible. */}
        <g className="stroke-[#cdbfa7] stroke-3">
          <line vectorEffect="non-scaling-stroke" x1={0} x2={0} y1={0} y2={1} />
          <line vectorEffect="non-scaling-stroke" x1={0} x2={1} y1={1} y2={1} />
        </g>
      </svg>
      {labels.map(({ index, pos, value }) => (
        <span
          className={cn(tick, "bottom-1.5 -translate-x-1/2")}
          key={`x${index}`}
          style={{ left: `${pos * 100}%` }}
        >
          {format.format(value)}
        </span>
      ))}
      {labels.map(({ index, pos, value }) => (
        <span
          className={cn(tick, "left-1.5 -translate-y-1/2")}
          key={`y${index}`}
          style={{ top: `${(1 - pos) * 100}%` }}
        >
          {format.format(value)}
        </span>
      ))}
      {mmPerCanvas && (
        <>
          <span className={cn(tick, "bottom-1.5 left-1.5")}>0</span>
          <span className={cn(tick, "top-1.5 left-1.5 font-bold text-muted")}>
            {unit}
          </span>
        </>
      )}
    </div>
  );
};

export default memo(DrawGrid);
