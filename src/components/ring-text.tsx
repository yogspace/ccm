import { memo, useId, useMemo } from "react";

/** Radius of the ring in the 100 × 100 view box; the letters stand on it. */
export const RING_RADIUS = 45;
const RADIUS = RING_RADIUS;
const AROUND = 2 * Math.PI * RADIUS;
/** Non-breaking spaces: SVG text would collapse ordinary ones. */
const SEPARATOR = "\u00a0\u00a0\u00a0✦\u00a0\u00a0\u00a0";
/** Font sizes in view-box units: as large as fits, never smaller than this. */
const LARGEST = 6;
const SMALLEST = 3.2;
const FONT = '600 100px "Pally", system-ui, sans-serif';

let measure: CanvasRenderingContext2D | null = null;

/** Width of a text at font size 1, in the font the ring uses. */
const widthOf = (text: string) => {
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return text.length * 0.55;
  measure.font = FONT;
  return measure.measureText(text).width / 100;
};

/**
 * Lays a text all the way around the ring: as large as fits, a short one
 * repeated until the ring closes; the letter spacing evens out the rest.
 */
export const ringLayout = (text: string) => {
  const unit = `${text.trim()}${SEPARATOR}`;
  const width = widthOf(unit);
  const copies = Math.max(1, Math.floor(AROUND / (width * LARGEST)));
  const content = unit.repeat(copies);
  const size = Math.max(SMALLEST, Math.min(LARGEST, AROUND / (width * copies)));
  const spacing = (AROUND - width * copies * size) / [...content].length;
  return { content, size, spacing: Math.max(0, spacing) };
};

type Props = { text: string; className?: string };

/** Text running once around a circle, like on a stamp. Decorative only. */
const RingText = ({ text, className }: Props) => {
  const id = useId();
  const { content, size, spacing } = useMemo(() => ringLayout(text), [text]);
  const r = RADIUS;

  return (
    <svg
      aria-hidden
      className={["ring-text", className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
    >
      {/* Clockwise from the top: the letters stand outwards, upright on top. */}
      <path
        d={`M 50 ${50 - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`}
        fill="none"
        id={id}
      />
      <text fontSize={size} letterSpacing={spacing}>
        <textPath href={`#${id}`}>{content}</textPath>
      </text>
    </svg>
  );
};

export default memo(RingText);
