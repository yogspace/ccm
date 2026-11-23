"use client";

import type { CSSProperties, PropsWithChildren } from "react";
import { LOCALE } from "../../stats/config";

/**
 * Building blocks of the analytics global.
 *
 * Text and lines through Payload's theme variables, data colors through
 * the `.stats-viz` ones (custom.scss) – light and dark mode both fit without
 * asking which one is on. The charts themselves are in charts.tsx.
 */

export const INK = "var(--theme-elevation-1000)";
export const TEXT = "var(--theme-elevation-800)";
export const MUTED = "var(--theme-elevation-500)";
export const LINE = "var(--theme-elevation-150)";

export const fmt = (n: number) => n.toLocaleString(LOCALE);

/** Seconds as “42 s”, “3:05 min”, “1:02 h”. */
export const duration = (seconds: number) => {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const two = (n: number) => String(n).padStart(2, "0");
  if (s < 3600) return `${Math.floor(s / 60)}:${two(s % 60)} min`;
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))} h`;
};

/** The middle value – a forgotten tab does not drag it up like the mean. */
export const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const Note = ({ children }: PropsWithChildren) => (
  <p
    style={{ color: MUTED, fontSize: 13, lineHeight: 1.45, margin: "0 0 16px" }}
  >
    {children}
  </p>
);

export const Loading = () => <Note>Loading …</Note>;

// ─── Key figures ─────────────────────────────────────────────────────────────

export const StatGrid = ({ children }: PropsWithChildren) => (
  // Three columns – full rows only: a tile that would stand alone spans the
  // rest (`span`). On phones one below the other (custom.scss,
  // .stats-viz__stats).
  <div className="stats-viz__stats">{children}</div>
);

export type Trend = "up" | "down" | "flat";

const TREND_ICON: Record<Trend, string> = { up: "▲", down: "▼", flat: "■" };
// More is good – the direction carries the color, and the sign before it
// says the same again without color.
const TREND_COLOR: Record<Trend, string> = {
  up: "var(--viz-up-text)",
  down: "var(--viz-down-text)",
  flat: MUTED,
};

/**
 * A key figure: label, value, below it optionally a comparison – and, as
 * `children`, its course or share, small and quiet. The number leads: a
 * single number is read fastest as a number.
 */
export const StatTile = ({
  label,
  value,
  format = fmt,
  detail,
  trend,
  detailTitle,
  span,
  children,
}: PropsWithChildren<{
  label: string;
  value: number;
  /** How the value reads – a count by default, `duration` for seconds. */
  format?: (value: number) => string;
  /** Comparison or context, e.g. “+12 % vs. the 7 days before”. */
  detail?: string;
  trend?: Trend;
  /** Tooltip of the detail line. */
  detailTitle?: string;
  /** How many of the grid's columns the tile spans (default 1). */
  span?: number;
}>) => (
  <div
    className="stats-viz__tile"
    style={{
      // As a variable, so phones can drop it.
      ...(span ? ({ "--span": span } as CSSProperties) : {}),
      background: "var(--theme-elevation-50)",
      border: "1px solid var(--theme-elevation-100)",
      borderRadius: "var(--style-radius-m)",
      padding: "14px 16px",
    }}
  >
    <div
      style={{
        color: MUTED,
        fontSize: 12,
        marginBottom: 6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        // One line, so the numbers of a row stand level.
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      {label}
    </div>
    <div
      style={{
        color: INK,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.1,
      }}
    >
      {format(value)}
    </div>
    {detail && (
      <div
        style={{
          color: trend ? TREND_COLOR[trend] : MUTED,
          display: "-webkit-box",
          fontSize: 12,
          lineHeight: 1.35,
          marginTop: 6,
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          // Two lines at most – the whole in the tooltip.
          WebkitLineClamp: 2,
        }}
        title={detailTitle ?? detail}
      >
        {trend && (
          <span aria-hidden="true" style={{ fontSize: 9, marginRight: 4 }}>
            {TREND_ICON[trend]}
          </span>
        )}
        {detail}
      </div>
    )}
    {children}
  </div>
);

/**
 * Two periods compared, as a tile's detail line. Without a previous value
 * there is no percentage – then it says what it started from.
 */
export const compare = (
  now: number,
  before: number,
  against: string
): { detail: string; trend: Trend; detailTitle: string } => {
  if (before === 0) {
    return now > 0
      ? {
          detail: "up from 0",
          trend: "up",
          detailTitle: `up from 0 ${against}`,
        }
      : {
          detail: "0 before too",
          trend: "flat",
          detailTitle: `0 ${against} as well`,
        };
  }
  const change = Math.round(((now - before) / before) * 100);
  return {
    detail: `${change > 0 ? "+" : ""}${change} % (${before.toLocaleString(LOCALE)} before)`,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
    detailTitle: `${change > 0 ? "+" : ""}${change} % vs. ${against}`,
  };
};

// ─── Controls ────────────────────────────────────────────────────────────────

/** An active restriction with a button to lift it – like “✕ Reset” in the heatmap. */
export const ResetChip = ({
  onReset,
  title,
}: {
  onReset: () => void;
  title: string;
}) => (
  <button
    onClick={onReset}
    style={{
      background: "var(--viz-1)",
      border: "none",
      borderRadius: 999,
      color: "var(--theme-elevation-0)",
      cursor: "pointer",
      font: "inherit",
      fontSize: 12,
      fontWeight: 600,
      padding: "3px 10px",
      whiteSpace: "nowrap",
    }}
    title={title}
    type="button"
  >
    ✕ Reset
  </button>
);

/** A row of equal buttons at the end of a section. */
export const ButtonRow = ({ children }: PropsWithChildren) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
    {children}
  </div>
);

const pill = (on: boolean) =>
  ({
    background: on ? "var(--theme-elevation-100)" : "none",
    border: `1px solid ${LINE}`,
    borderRadius: 999,
    color: TEXT,
    cursor: "pointer",
    font: "inherit",
    fontSize: 11,
    fontWeight: on ? 600 : 400,
    padding: "2px 10px",
  }) as const;

/** A row of pills, one of them on – switches between views of a card. */
export const Switches = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
    {options.map((option) => (
      <button
        aria-pressed={value === option.value}
        key={option.value}
        onClick={() => onChange(option.value)}
        style={pill(value === option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </span>
);
