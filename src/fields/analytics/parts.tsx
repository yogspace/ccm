"use client";

import { Button } from "@payloadcms/ui";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { useState } from "react";

/**
 * Building blocks of the analytics global.
 *
 * Colors only through Payload's theme variables, so light and dark mode both
 * fit without asking which one is on. The one data color is Payload's
 * “success” (a blue there) – the same as in the heatmap (visit-matrix.tsx).
 */

export const INK = "var(--theme-elevation-1000)";
export const TEXT = "var(--theme-elevation-800)";
export const MUTED = "var(--theme-elevation-500)";
export const LINE = "var(--theme-elevation-150)";
export const DATA = "var(--theme-success-500)";
export const DATA_HOVER = "var(--theme-success-700)";

export const fmt = (n: number) => n.toLocaleString("de-DE");

export const Note = ({ children }: PropsWithChildren) => (
  <p
    style={{ color: MUTED, fontSize: 13, lineHeight: 1.45, margin: "0 0 16px" }}
  >
    {children}
  </p>
);

export const Loading = () => <Note>Loading …</Note>;

/** A heading inside a section, optionally with controls on the right. */
export const Subsection = ({
  title,
  aside,
  children,
}: PropsWithChildren<{ title: string; aside?: ReactNode }>) => (
  <div style={{ marginBottom: 24 }}>
    <div
      style={{
        alignItems: "baseline",
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <h4 style={{ color: TEXT, fontSize: 13, fontWeight: 600, margin: 0 }}>
        {title}
      </h4>
      {aside}
    </div>
    {children}
  </div>
);

// ─── Key figures ─────────────────────────────────────────────────────────────

export const StatGrid = ({ children }: PropsWithChildren) => (
  <div
    style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      marginBottom: 8,
    }}
  >
    {children}
  </div>
);

export type Trend = "up" | "down" | "flat";

const TREND_ICON: Record<Trend, string> = { up: "▲", down: "▼", flat: "■" };
// More is good – the direction carries the color, and the sign before it
// says the same again without color.
const TREND_COLOR: Record<Trend, string> = {
  up: "var(--theme-success-500)",
  down: "var(--theme-error-500)",
  flat: MUTED,
};

/**
 * A key figure: label, value, below it optionally a comparison. No chart – a
 * single number is read fastest as a number.
 */
export const StatTile = ({
  label,
  value,
  detail,
  trend,
  detailTitle,
}: {
  label: string;
  value: number;
  /** Comparison or context, e.g. “+12 % vs. the 7 days before”. */
  detail?: string;
  trend?: Trend;
  /** Tooltip of the detail line. */
  detailTitle?: string;
}) => (
  <div
    style={{
      background: "var(--theme-elevation-50)",
      border: "1px solid var(--theme-elevation-100)",
      borderRadius: "var(--style-radius-m)",
      padding: "14px 16px",
    }}
  >
    <div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>{label}</div>
    <div
      style={{
        color: INK,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.1,
      }}
    >
      {fmt(value)}
    </div>
    {detail && (
      <div
        style={{
          color: trend ? TREND_COLOR[trend] : MUTED,
          fontSize: 12,
          marginTop: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={detailTitle ?? detail}
      >
        {trend && (
          <span aria-hidden style={{ fontSize: 9, marginRight: 4 }}>
            {TREND_ICON[trend]}
          </span>
        )}
        {detail}
      </div>
    )}
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
): { detail: string; trend: Trend } => {
  if (before === 0) {
    return now > 0
      ? { detail: `up from 0 ${against}`, trend: "up" }
      : { detail: `0 ${against} as well`, trend: "flat" };
  }
  const change = Math.round(((now - before) / before) * 100);
  return {
    detail: `${change > 0 ? "+" : ""}${change} % vs. ${against}`,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
};

// ─── Bar chart ───────────────────────────────────────────────────────────────

export type Bucket = {
  label: string;
  count: number;
  /** Long label for tooltip and screen readers. */
  title?: string;
  /** Show the label on the axis? (Without: every one.) */
  tick?: boolean;
  /** Still running (this hour, today) – drawn lighter. */
  partial?: boolean;
  /** The bar's time span [from, to) – for clicking. */
  from?: number;
  to?: number;
};

const PLOT_H = 140;
// Room above the plot for the tallest bar's tooltip.
const HEADROOM = 34;
const AXIS_W = 32;
const AXIS_H = 22;

/** Round axis steps (1, 2, 5, 10, 20 …) for whole numbers. */
const niceStep = (max: number) => {
  const raw = Math.max(1, max / 4);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow);
};

/**
 * Columns over time, always exactly as wide as the room – no scrollbar: the
 * bars share the width, narrow for 90 days, wide (at most 24 px) for 24
 * hours. A quiet axis with round steps; a number only at the tallest bar,
 * the rest in the tooltip – on pointer AND keyboard focus, hit by the whole
 * column, not just the bar. The running period stands lighter, otherwise
 * every end would read as a drop.
 */
export const BarChart = ({
  buckets,
  unit = "views",
  selectedFrom = null,
  onSelect,
}: {
  buckets: Bucket[];
  unit?: string;
  /** The chosen bar (by its start) – highlighted, the rest steps back. */
  selectedFrom?: number | null;
  /** Click on a bar; without it the chart is only to look at. */
  onSelect?: (bucket: Bucket) => void;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (!buckets.length || total === 0) {
    return <Note>No {unit} in this range.</Note>;
  }

  const n = buckets.length;
  const max = Math.max(...buckets.map((b) => b.count));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const peak = buckets.findIndex((b) => b.count === max);
  const yOf = (count: number) => HEADROOM + PLOT_H - (count / top) * PLOT_H;
  // The middle of column i, as a CSS length over the plot's width.
  const xOf = (i: number) =>
    `calc(${AXIS_W}px + (100% - ${AXIS_W}px) * ${(i + 0.5) / n})`;
  // At the edges aligned inwards, so nothing sticks out of the chart.
  const anchor = (i: number) => {
    const f = (i + 0.5) / n;
    return f < 0.08 ? "0%" : f > 0.92 ? "-100%" : "-50%";
  };
  const gap = n > 60 ? 1 : 2;
  const current = active === null ? null : buckets[active];
  const isSelected = (b: Bucket) =>
    selectedFrom !== null && b.from === selectedFrom;
  const hasSelection = buckets.some(isSelected);

  return (
    <div
      style={{
        height: HEADROOM + PLOT_H + AXIS_H,
        marginTop: 4,
        position: "relative",
      }}
    >
      {ticks.map((v) => (
        <div
          aria-hidden
          key={v}
          style={{ left: 0, position: "absolute", right: 0, top: yOf(v) }}
        >
          <span
            style={{
              color: MUTED,
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
              left: 0,
              position: "absolute",
              textAlign: "right",
              transform: "translateY(-50%)",
              width: AXIS_W - 8,
            }}
          >
            {fmt(v)}
          </span>
          <div
            style={{
              borderTop: `1px solid ${
                v === 0
                  ? "var(--theme-elevation-250)"
                  : "var(--theme-elevation-100)"
              }`,
              left: AXIS_W,
              position: "absolute",
              right: 0,
            }}
          />
        </div>
      ))}

      <div
        style={{
          alignItems: "stretch",
          display: "flex",
          gap,
          height: PLOT_H,
          left: AXIS_W,
          position: "absolute",
          right: 0,
          top: HEADROOM,
        }}
      >
        {buckets.map((b, i) => {
          const on = active === i;
          const selected = isSelected(b);
          return (
            <button
              aria-label={`${b.title ?? b.label}: ${fmt(b.count)} ${unit}${
                b.partial ? " so far" : ""
              }`}
              aria-pressed={onSelect ? selected : undefined}
              key={`${b.label}-${i}`}
              onBlur={() => setActive(null)}
              onClick={onSelect ? () => onSelect(b) : undefined}
              onFocus={() => setActive(i)}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              style={{
                alignItems: "flex-end",
                background: on ? "var(--theme-elevation-50)" : "transparent",
                border: "none",
                borderRadius: 3,
                cursor: onSelect ? "pointer" : "default",
                display: "flex",
                flex: "1 1 0",
                height: "100%",
                justifyContent: "center",
                minWidth: 0,
                padding: 0,
              }}
              type="button"
            >
              <span
                style={{
                  background: on || selected ? DATA_HOVER : DATA,
                  borderRadius: n > 60 ? "2px 2px 0 0" : "4px 4px 0 0",
                  display: "block",
                  height: `${(b.count / top) * 100}%`,
                  maxWidth: 24,
                  minHeight: b.count > 0 ? 2 : 0,
                  opacity:
                    hasSelection && !selected && !on
                      ? 0.3
                      : b.partial && !on && !selected
                        ? 0.5
                        : 1,
                  transition: "background 120ms ease, opacity 120ms ease",
                  width: "72%",
                }}
              />
            </button>
          );
        })}
      </div>

      {peak >= 0 && active !== peak && (
        <span
          aria-hidden
          style={{
            color: TEXT,
            fontSize: 11,
            fontWeight: 600,
            left: xOf(peak),
            position: "absolute",
            top: yOf(max) - 18,
            transform: `translateX(${anchor(peak)})`,
            whiteSpace: "nowrap",
          }}
        >
          {fmt(max)}
        </span>
      )}

      {buckets.map((b, i) =>
        b.tick === false ? null : (
          <span
            aria-hidden
            key={`tick-${b.label}-${i}`}
            style={{
              color: MUTED,
              fontSize: 11,
              left: xOf(i),
              position: "absolute",
              top: HEADROOM + PLOT_H + 6,
              transform: `translateX(${anchor(i)})`,
              whiteSpace: "nowrap",
            }}
          >
            {b.label}
          </span>
        )
      )}

      {current && active !== null && (
        <div
          style={{
            background: "var(--theme-elevation-900)",
            borderRadius: "var(--style-radius-s)",
            color: "var(--theme-elevation-0)",
            fontSize: 12,
            left: xOf(active),
            padding: "4px 8px",
            pointerEvents: "none",
            position: "absolute",
            top: yOf(current.count) - 8,
            transform: `translate(${anchor(active)}, -100%)`,
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          <strong>{fmt(current.count)}</strong>{" "}
          <span style={{ opacity: 0.8 }}>
            {current.title ?? current.label}
            {current.partial ? " · so far" : ""}
          </span>
          {onSelect && (
            <span style={{ display: "block", fontSize: 11, opacity: 0.65 }}>
              {isSelected(current)
                ? "Click again to show the whole range"
                : "Click to show this in Visitors"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Lists ───────────────────────────────────────────────────────────────────

/** [name, value, detail?] – the detail stands muted next to the value. */
export type Entry = [string, number, string?];

const listBase: CSSProperties = {
  fontSize: 13,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

/**
 * Ranking with a thin bar under each name – the distribution reads without
 * comparing numbers. Collapsed: the first ten.
 */
export const RankList = ({ entries }: { entries: Entry[] }) => {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return <Note>Nothing yet.</Note>;
  const shown = expanded ? entries : entries.slice(0, 10);
  const max = Math.max(...entries.map(([, n]) => n), 1);

  return (
    <>
      <ul style={listBase}>
        {shown.map(([name, count, detail]) => (
          <li
            key={name}
            style={{
              borderTop: "1px solid var(--theme-elevation-100)",
              padding: "6px 0",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
              <span
                style={{
                  color: TEXT,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={name}
              >
                {name}
              </span>
              {detail && (
                <span style={{ color: MUTED, fontSize: 12 }}>{detail}</span>
              )}
              <strong
                style={{ color: INK, fontVariantNumeric: "tabular-nums" }}
              >
                {fmt(count)}
              </strong>
            </div>
            <div
              aria-hidden
              style={{
                background: DATA,
                borderRadius: 2,
                height: 3,
                marginTop: 4,
                opacity: 0.55,
                width: `${Math.max((count / max) * 100, 1)}%`,
              }}
            />
          </li>
        ))}
      </ul>
      {entries.length > 10 && (
        <Button
          buttonStyle="subtle"
          margin={false}
          onClick={() => setExpanded((e) => !e)}
          size="small"
          type="button"
        >
          {expanded ? "Show less" : `Show all (${entries.length})`}
        </Button>
      )}
    </>
  );
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
      background: "var(--theme-success-600)",
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
