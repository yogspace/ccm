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
