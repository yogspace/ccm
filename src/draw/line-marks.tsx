import { useLayoutEffect, useRef, useState } from "react";
import { ANCHOR, anchorCount, type Guides, noHandle } from "../bezier";
import { DRAW_RES as RES } from "../drawing";
import type { LineMarking } from "./use-line";

/** A thin line in the accent on a white edge – readable on paper and on ink. */
const Line = ({ d, dashed }: { d: string; dashed?: boolean }) => (
  <>
    <path d={d} stroke="white" strokeOpacity={0.85} strokeWidth={3.5} />
    <path
      d={d}
      stroke="var(--color-accent)"
      strokeDasharray={dashed ? "5 4" : undefined}
      strokeWidth={1.5}
    />
  </>
);

/**
 * What the line tool and editing its points draw over the drawing: the line
 * itself, thin; its anchors as small squares (the picked one filled, the
 * first one ringed when a press would close the line); handles as lines
 * with round ends; the next curve to the pointer, dashed; and the guides an
 * anchor has snapped to. On touch everything a little bigger. It never
 * takes a pointer.
 */
const LineMarks = ({
  marks,
  lines,
  touch,
}: {
  marks: LineMarking | null;
  lines: Guides | null;
  touch: boolean;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const watch = new ResizeObserver(() => setSize(element.clientWidth));
    watch.observe(element);
    setSize(element.clientWidth);
    return () => watch.disconnect();
  }, []);
  const px = (value: number) => (value * size) / RES;
  const at = (x: number, y: number) =>
    `${px(x).toFixed(1)} ${px(y).toFixed(1)}`;
  const half = touch ? 5.5 : 4;
  const anchors = marks?.anchors ?? [];
  const count = anchorCount(anchors);
  const shows = (i: number) =>
    marks?.handles === "all" || (marks?.handles === "last" && i === count - 1);
  const preview = marks?.preview;
  const guides = lines && [
    ...lines.x.map((x) => `M${px(x).toFixed(1)} 0V${size}`),
    ...lines.y.map((y) => `M0 ${px(y).toFixed(1)}H${size}`),
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-1 size-full"
      ref={box}
    >
      {size > 0 && (
        <svg
          aria-hidden
          className="size-full overflow-visible"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox={`0 0 ${size} ${size}`}
        >
          {guides && guides.length > 0 && (
            <path
              d={guides.join("")}
              stroke="var(--color-accent)"
              strokeDasharray="2 3"
              strokeOpacity={0.7}
              strokeWidth={1}
            />
          )}
          {marks && marks.line.length >= 2 && (
            <Line d={`M${marks.line.map(([x, y]) => at(x, y)).join("L")}`} />
          )}
          {preview && (
            <Line
              d={`M${at(preview[0], preview[1])}C${at(preview[2], preview[3])} ${at(preview[4], preview[5])} ${at(preview[6], preview[7])}`}
              dashed
            />
          )}
          {Array.from({ length: count }, (_, i) => i).map((i) => {
            const k = i * ANCHOR;
            return (["in", "out"] as const).map((side) => {
              if (!shows(i) || noHandle(anchors, i, side)) return null;
              const h = k + (side === "in" ? 2 : 4);
              return (
                <g key={`${i}-${side}`}>
                  <Line
                    d={`M${at(anchors[k], anchors[k + 1])}L${at(anchors[h], anchors[h + 1])}`}
                  />
                  <circle
                    cx={px(anchors[h])}
                    cy={px(anchors[h + 1])}
                    fill="var(--color-paper)"
                    r={half - 0.5}
                    stroke="var(--color-accent)"
                    strokeWidth={1.5}
                  />
                </g>
              );
            });
          })}
          {Array.from({ length: count }, (_, i) => i).map((i) => {
            const x = px(anchors[i * ANCHOR]);
            const y = px(anchors[i * ANCHOR + 1]);
            return (
              <g key={i}>
                {marks?.closing && i === 0 && (
                  <circle
                    cx={x}
                    cy={y}
                    r={half + 5}
                    stroke="var(--color-accent)"
                    strokeWidth={1.5}
                  />
                )}
                <rect
                  fill={
                    marks?.picked === i
                      ? "var(--color-accent)"
                      : "var(--color-paper)"
                  }
                  height={half * 2}
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                  width={half * 2}
                  x={x - half}
                  y={y - half}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

export default LineMarks;
