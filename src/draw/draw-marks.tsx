import { type Box, DRAW_RES as RES } from "../drawing";
import type { Ring } from "../geometry/outline";
import { type Frame, HANDLES } from "./frame";
import type { Guides } from "./guides";
import { KNOB } from "./use-move";
import { toStage, type View } from "./view";

/** A place in drawing-area pixels as a share of the stage – through the view. */
const at = (view: View, x: number, y: number) => {
  const [sx, sy] = toStage(view, x / RES, y / RES);
  return { left: `${sx * 100}%`, top: `${sy * 100}%` };
};
/** A length in drawing-area pixels as a share of the stage. */
const share = (view: View, value: number) => `${(value / RES) * view.s * 100}%`;

/** The visible part of the area, in its own terms (0–1) – an SVG's viewBox. */
const viewBox = (view: View) =>
  `${-view.x / view.s} ${-view.y / view.s} ${1 / view.s} ${1 / view.s}`;

/** The cutting line on the paper – the cutter's outline, marching. */
export const CuttingLine = ({
  outline,
  view,
}: {
  outline: Ring[];
  view: View;
}) => (
  <svg
    aria-hidden
    className="pointer-events-none absolute inset-0 size-full overflow-hidden"
    preserveAspectRatio="none"
    viewBox={viewBox(view)}
  >
    <path
      className="animate-[march_0.8s_linear_infinite] fill-cut stroke-cut stroke-2 [fill-opacity:0.06] [stroke-dasharray:6_5] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]"
      d={outline
        .map((ring) => `M${ring.map(([x, y]) => `${x},${y}`).join("L")}Z`)
        .join("")}
    />
  </svg>
);

/**
 * The selection: a frame – turned as it is turned – with handles at its
 * corners and the middles of its sides; on touch a knob above it turns it.
 */
export const SelectionFrame = ({
  frame,
  view,
  knob,
}: {
  frame: Frame;
  view: View;
  knob: boolean;
}) => (
  <div
    aria-hidden
    className="pointer-events-none absolute z-1 origin-center -translate-1/2 rounded-sm border-2 border-dashed border-accent"
    style={{
      ...at(view, frame.cx, frame.cy),
      width: share(view, frame.w),
      height: share(view, frame.h),
      rotate: `${frame.angle}rad`,
    }}
  >
    {HANDLES.map(([hx, hy]) => (
      <i
        className="absolute size-3 -translate-1/2 rounded-full border-2 border-accent bg-paper"
        key={`${hx}${hy}`}
        style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%` }}
      />
    ))}
    {knob && (
      <>
        <i
          className="absolute left-1/2 w-0 -translate-x-1/2 border-l-2 border-accent"
          style={{ top: -KNOB, height: KNOB }}
        />
        <i
          className="absolute left-1/2 size-4 -translate-1/2 rounded-full border-2 border-accent bg-accent-soft"
          style={{ top: -KNOB }}
        />
      </>
    )}
  </div>
);

/** What a press would select – a thin frame round it. */
export const HoverBox = ({ box, view }: { box: Box; view: View }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute z-1 rounded-sm border-[1.5px] border-accent/70"
    style={{
      ...at(view, box.x0, box.y0),
      width: share(view, box.x1 - box.x0),
      height: share(view, box.y1 - box.y0),
    }}
  />
);

/** The box being dragged to select. */
export const MarqueeBox = ({ box, view }: { box: Box; view: View }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute z-1 rounded-sm border-[1.5px] border-dashed border-accent bg-accent/10"
    style={{
      ...at(view, box.x0, box.y0),
      width: share(view, box.x1 - box.x0),
      height: share(view, box.y1 - box.y0),
    }}
  />
);

/** The guides what is moved or sized lies on – across the area. */
export const GuideLines = ({ lines, view }: { lines: Guides; view: View }) => (
  <svg
    aria-hidden
    className="pointer-events-none absolute inset-0 z-1 size-full"
    preserveAspectRatio="none"
    viewBox={viewBox(view)}
  >
    <path
      d={[
        ...lines.x.map((x) => `M${x / RES} 0V1`),
        ...lines.y.map((y) => `M0 ${y / RES}H1`),
      ].join("")}
      stroke="var(--color-accent)"
      strokeDasharray="2 3"
      strokeOpacity={0.7}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);
