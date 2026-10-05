import { memo } from "react";
import { useTranslation } from "react-i18next";
import { numberFormat, type Unit } from "../units";

type Props = {
  /** Wie viele mm die Breite der Zeichenfläche im fertigen Ausstecher sind. */
  mmPerCanvas: number | null;
  unit: Unit;
};

const MM_PER_INCH = 25.4;
/** Ohne Form gibt es keinen Maßstab – dann ein neutrales 8×8-Raster. */
const FALLBACK_DIVISIONS = 8;
/** Beschriftungen zu nah am Rand würden abgeschnitten. */
const LABEL_MARGIN = 0.1;

/** Rundet auf 1, 2 oder 5 mal eine Zehnerpotenz. */
const niceStep = (raw: number) => {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (
    (fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10) * power
  );
};

/** `index` bleibt beim Zoomen gleich – so werden Linien verschoben statt neu angelegt. */
type Tick = { index: number; pos: number; value: number; major: boolean };

const buildTicks = (span: number): Tick[] => {
  const step = niceStep(span / 8);
  const minor = step / 2;
  const count = Math.floor(span / 2 / minor);
  const ticks: Tick[] = [];
  for (let i = -count; i <= count; i++) {
    const value = i * minor;
    ticks.push({
      index: i,
      pos: 0.5 + value / span,
      value,
      major: i % 2 === 0,
    });
  }
  return ticks;
};

/** Koordinatensystem unter der Zeichnung: Raster, Achsen und Lineal in echten Maßen. */
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
  const labels = mmPerCanvas
    ? ticks.filter(
        ({ pos, major, value }) =>
          major && value !== 0 && pos > LABEL_MARGIN && pos < 1 - LABEL_MARGIN
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
            <line
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={1}
              y1={pos}
              y2={pos}
            />
          </g>
        ))}
        <g className="axis">
          <line
            vectorEffect="non-scaling-stroke"
            x1={0.5}
            x2={0.5}
            y1={0}
            y2={1}
          />
          <line
            vectorEffect="non-scaling-stroke"
            x1={0}
            x2={1}
            y1={0.5}
            y2={0.5}
          />
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
        // y zeigt im Ausstecher nach oben, im Canvas nach unten.
        <span
          className="tick y"
          key={`y${index}`}
          style={{ top: `${pos * 100}%` }}
        >
          {format.format(-value)}
        </span>
      ))}
      {mmPerCanvas && <span className="tick unit">{unit}</span>}
    </div>
  );
};

export default memo(DrawGrid);
