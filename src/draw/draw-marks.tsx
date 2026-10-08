import { type Box, DRAW_RES as RES } from "../drawing";
import type { Ring } from "../geometry/outline";
import type { Frame } from "./gesture-math";

/** The selection's handles at its corners. */
const CORNERS = [
  "top-0 left-0",
  "top-0 left-full",
  "top-full left-full",
  "top-full left-0",
];

/** A length in drawing-area pixels as a share of the area. */
const share = (value: number) => `${(value / RES) * 100}%`;

/** The cutting line on the paper – the cutter's outline, marching. */
export const CuttingLine = ({ outline }: { outline: Ring[] }) => (
  <svg
    aria-hidden
    className="pointer-events-none absolute inset-0 size-full overflow-visible"
    preserveAspectRatio="none"
    viewBox="0 0 1 1"
  >
    <path
      className="animate-[march_0.8s_linear_infinite] fill-cut stroke-cut stroke-2 [fill-opacity:0.06] [stroke-dasharray:6_5] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]"
      d={outline
        .map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`)
        .join("")}
    />
  </svg>
);

/** The selection while moving: a frame with handles at the corners. */
export const SelectionFrame = ({ frame }: { frame: Frame }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute z-1 origin-center rounded-sm border-2 border-dashed border-accent"
    style={{
      left: share(frame.cx - frame.w / 2),
      top: share(frame.cy - frame.h / 2),
      width: share(frame.w),
      height: share(frame.h),
      rotate: `${frame.angle}rad`,
    }}
  >
    {CORNERS.map((corner) => (
      <i
        className={`absolute size-3 -translate-1/2 rounded-full border-2 border-accent bg-paper ${corner}`}
        key={corner}
      />
    ))}
  </div>
);

/** The box being dragged to select several. */
export const MarqueeBox = ({ box }: { box: Box }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute z-1 rounded-sm border-[1.5px] border-dashed border-accent bg-accent/10"
    style={{
      left: share(box.x0),
      top: share(box.y0),
      width: share(box.x1 - box.x0),
      height: share(box.y1 - box.y0),
    }}
  />
);
