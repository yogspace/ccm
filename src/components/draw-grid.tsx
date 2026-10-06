import { memo } from "react";
import { useTranslation } from "react-i18next";
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
    <div aria-hidden className="grid">
      <svg
        aria-hidden
        className="grid-lines"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        {ticks.map(({ index, pos, major }) => (
          <g className={major ? "major" : "minor"} key={index}>
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
        {/* Axes: left and bottom edge */}
        <g className="axis">
          <line vectorEffect="non-scaling-stroke" x1={0} x2={0} y1={0} y2={1} />
          <line vectorEffect="non-scaling-stroke" x1={0} x2={1} y1={1} y2={1} />
        </g>
      </svg>
      {labels.map(({ index, pos, value }) => (
        <span
          className="tick x"
          key={`x${index}`}
          style={{ left: `${pos * 100}%` }}
        >
          {format.format(value)}
        </span>
      ))}
      {labels.map(({ index, pos, value }) => (
        <span
          className="tick y"
          key={`y${index}`}
          style={{ top: `${(1 - pos) * 100}%` }}
        >
          {format.format(value)}
        </span>
      ))}
      {mmPerCanvas && (
        <>
          <span className="tick origin">0</span>
          <span className="tick unit">{unit}</span>
        </>
      )}
    </div>
  );
};

export default memo(DrawGrid);
