"use client";

import { Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { LOCALE } from "../stats/config";
import { pathLabel, pathName } from "../stats/page-names";
import {
  buildVisitMatrix,
  OTHER,
  type Visit,
  type VisitAxis,
  visitShade,
} from "../stats/visit-matrix";

type Hover =
  | { kind: "cell"; row: string; col: string }
  | { kind: "col"; col: string };

/** Rows visible while collapsed. */
const MAX_ROWS = 10;

/**
 * The shading as the seven steps of the charts' blue ramp (custom.scss,
 * `--viz-seq-*`), turned round in dark mode – “more views = further from
 * the ground” holds in both – with a text color that reads on each step.
 */
const RAMP = [1, 2, 3, 4, 5, 6, 7] as const;

const muted = { color: "var(--theme-elevation-400)" } as const;

// The totals row apart from the grid: it is the sum below, not one more page.
const footCell: CSSProperties = {
  borderTop: "1px solid var(--theme-elevation-150)",
  paddingTop: 6,
  fontSize: 11,
};

const stamp = (at: number) =>
  new Date(at).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** A cell's height – the largest circle fits with a little air. */
const CELL = 40;
const MIN_D = 8;
const MAX_D = 34;

/**
 * A cell as a circle: its AREA grows with the count (the diameter with the
 * square root – twice the number looks twice as big, not four times), its
 * tone follows the ramp. The number stands inside where the circle has room
 * for it; smaller ones tell it in the readout below the grid.
 */
const Bubble = ({
  count,
  max,
  shade,
  hovered,
}: {
  count: number;
  max: number;
  shade?: CSSProperties;
  hovered: boolean;
}) => {
  if (!count) {
    return (
      <span
        aria-hidden="true"
        style={{
          background: "var(--theme-elevation-100)",
          borderRadius: 999,
          display: "inline-block",
          height: 4,
          width: 4,
        }}
      />
    );
  }
  const d = Math.round(MIN_D + Math.sqrt(count / max) * (MAX_D - MIN_D));
  return (
    <span
      aria-label={String(count)}
      role="img"
      style={{
        ...shade,
        alignItems: "center",
        borderRadius: 999,
        boxShadow: hovered ? "0 0 0 2px var(--theme-text)" : undefined,
        display: "inline-flex",
        fontSize: d >= 22 ? 11 : 0,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        height: d,
        justifyContent: "center",
        transition: "box-shadow 0.1s",
        verticalAlign: "middle",
        width: d,
      }}
    >
      {d >= 22 ? count : null}
    </span>
  );
};

/**
 * Pages × devices (or visitors, or places) as ONE grid – a heatmap of
 * circles, each as large and as dark as its count. A ROW reads “who was on
 * this page”, a COLUMN “which pages did this one open”. With `swappable` a
 * switch turns the axes.
 *
 * A click on a column header chooses that column: rows order by it, rows
 * without a view there disappear, and under each name stands this one cell's
 * state (“5 of 36 · last 13.09. 21:44”). The calculation lives in
 * stats/visit-matrix.
 *
 * The columns are device profiles by default; `columnNoun` names them
 * otherwise – Visitors puts visitors there, Locations places (`device` then
 * holds the visitor or the place).
 */
export const VisitMatrix = ({
  visits,
  onResetDevice,
  busy = false,
  columnNoun = { one: "device", many: "devices" },
  maxColumns,
  otherInMax,
  swappable = true,
}: {
  visits: Visit[];
  /** Deletes all views of a column (device profile, visitor); without it there is no button. */
  onResetDevice?: (device: string) => void;
  busy?: boolean;
  /** What the columns are, singular and plural. */
  columnNoun?: { one: string; many: string };
  /** Named columns before the rest becomes “Other” (default 6). */
  maxColumns?: number;
  /** See buildVisitMatrix – off where the columns are many small ones. */
  otherInMax?: boolean;
  /** Whether the axes can be turned (“By page” / “By …”). */
  swappable?: boolean;
}) => {
  const [rowAxis, setRowAxis] = useState<VisitAxis>("page");
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);

  if (!visits.length) return null;

  const colAxis: VisitAxis = rowAxis === "page" ? "device" : "page";
  const { columns, rows, cell, columnTotal, max, activeCol } = buildVisitMatrix(
    visits,
    { rowAxis, sortCol, maxColumns, otherInMax }
  );
  const shown = expanded ? rows : rows.slice(0, MAX_ROWS);

  const shade = (count: number): CSSProperties => {
    const index = Math.ceil(visitShade(count, max) * RAMP.length) - 1;
    const step = RAMP[Math.max(0, Math.min(RAMP.length - 1, index))];
    return {
      background: `var(--viz-seq-${step})`,
      color: `var(--viz-seq-ink-${step})`,
    };
  };

  const nameOf = (key: string) => {
    if (key === OTHER) return "Other";
    return pathLabel(key);
  };

  const noun = (axis: VisitAxis) =>
    axis === "device" ? columnNoun.many : "pages";

  // Deleting as an action of its own, outlined red – apart from the blue
  // “Reset” that only resets the view.
  const deleteButton = (device: string, compact: boolean) =>
    onResetDevice && device !== OTHER ? (
      <button
        aria-label={`Delete all views of "${device}"`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onResetDevice(device);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          border: "1px solid var(--theme-error-500)",
          borderRadius: 999,
          background: "transparent",
          color: "var(--theme-error-500)",
          font: "inherit",
          fontSize: 12,
          fontWeight: 600,
          padding: compact ? 4 : "4px 12px",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.5 : 1,
        }}
        title={`Delete all views of "${device}"`}
        type="button"
      >
        <Trash2 size={compact ? 12 : 13} />
        {compact ? null : `Delete this ${columnNoun.one}'s views`}
      </button>
    ) : null;

  // The line below the grid: what is under the pointer.
  const readout = (() => {
    if (!hover) return null;
    const { col } = hover;
    if (hover.kind === "cell") {
      const value = cell(hover.row, col);
      if (!value) return `${nameOf(hover.row)} × ${nameOf(col)}: no views`;
      return `${nameOf(hover.row)} × ${nameOf(col)}: ${value.count} views · last ${stamp(value.lastAt)}`;
    }
    const total = columnTotal(col);
    const reach = rows.filter(([row]) => cell(row, col));
    return total
      ? `${nameOf(col)}: ${total.count} views on ${reach.length} ${noun(rowAxis)} · last ${stamp(total.lastAt)}`
      : null;
  })();

  // A name as column header or row label. Devices in the HEADER stacked
  // (class, then system, then browser) – in one line three times as wide as
  // the number below. In the ROW on two lines: there is width, not height.
  const label = (key: string, axis: VisitAxis, inHeader: boolean) => {
    if (axis === "device" && key !== OTHER) {
      const [head, ...rest] = key.split(" · ");
      return (
        <span style={{ display: "block" }} title={key}>
          <span style={{ display: "block" }}>{head}</span>
          {inHeader ? (
            rest.map((part) => (
              <span
                key={part}
                style={{ ...muted, display: "block", fontSize: 11 }}
              >
                {part}
              </span>
            ))
          ) : rest.length > 0 ? (
            <span style={{ ...muted, display: "block", fontSize: 11 }}>
              {rest.join(" · ")}
            </span>
          ) : null}
        </span>
      );
    }

    const page = axis === "page" ? pathName(key) : null;
    if (page) {
      const tag = (
        <span
          style={{
            ...muted,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          {page.locale?.toUpperCase()}
        </span>
      );
      return inHeader ? (
        <span style={{ display: "block" }} title={key}>
          <span
            style={{
              display: "block",
              margin: "0 auto",
              maxWidth: 96,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {page.label}
          </span>
          <span style={{ display: "block" }}>{tag}</span>
        </span>
      ) : (
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={key}
        >
          {page.label} {tag}
        </span>
      );
    }

    // Paths in the header shortened from the front: the end names the page.
    const shown = key === OTHER ? "Other" : key;
    const short =
      inHeader && shown.startsWith("/") && shown.length > 14
        ? `…/${shown.split("/").filter(Boolean).pop() ?? ""}`
        : shown;
    return (
      <span
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: inHeader ? 96 : undefined,
          margin: inHeader ? "0 auto" : undefined,
        }}
        title={key}
      >
        {short}
      </span>
    );
  };

  const toggle = (axis: VisitAxis, text: string) => {
    const active = rowAxis === axis;
    return (
      <button
        aria-pressed={active}
        onClick={() => {
          setRowAxis(axis);
          setExpanded(false);
          setHover(null);
          // After turning, the columns are others – a remembered one is moot.
          setSortCol(null);
        }}
        style={{
          border: "1px solid var(--theme-elevation-400)",
          background: active ? "var(--theme-text)" : "transparent",
          color: active ? "var(--theme-elevation-0)" : "var(--theme-text)",
          font: "inherit",
          fontSize: 12,
          fontWeight: active ? 600 : 400,
          padding: "4px 12px",
          cursor: "pointer",
          borderRadius: axis === "page" ? "4px 0 0 4px" : "0 4px 4px 0",
          marginLeft: axis === "page" ? 0 : -1,
        }}
        type="button"
      >
        {text}
      </button>
    );
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        {swappable && (
          <div style={{ display: "flex" }}>
            {toggle("page", "By page")}
            {toggle("device", `By ${columnNoun.one}`)}
          </div>
        )}
        {activeCol && colAxis === "device" && deleteButton(activeCol, false)}
        {activeCol && (
          <button
            onClick={() => {
              setSortCol(null);
              setExpanded(false);
            }}
            style={{
              border: "none",
              borderRadius: 999,
              background: "var(--viz-1)",
              color: "#ffffff",
              font: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 12px",
              cursor: "pointer",
            }}
            title={`Clear the selection "${nameOf(activeCol)}"`}
            type="button"
          >
            ✕ Reset
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          onMouseLeave={() => setHover(null)}
          style={{
            borderCollapse: "separate",
            borderSpacing: 2,
            fontSize: 12,
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={{ minWidth: 160 }} />
              {columns.map((col) => {
                const active = activeCol === col;
                return (
                  <th
                    aria-sort={active ? "descending" : undefined}
                    key={col}
                    onMouseEnter={() => setHover({ kind: "col", col })}
                    style={{
                      padding: 0,
                      // The mark on the CELL, not the button: headers differ
                      // in height, the cell is always as high as the row.
                      background: active ? "var(--viz-select)" : "none",
                      borderBottom: active
                        ? "3px solid var(--viz-1)"
                        : "3px solid transparent",
                      borderRadius: "4px 4px 0 0",
                      fontWeight: active ? 600 : 400,
                      verticalAlign: "bottom",
                      textAlign: "center",
                      minWidth: 64,
                      height: 1,
                    }}
                  >
                    <button
                      onClick={() =>
                        setSortCol((current) => (current === col ? null : col))
                      }
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        width: "100%",
                        height: "100%",
                        padding: "6px 6px 4px",
                        border: "none",
                        background: "none",
                        color: "inherit",
                        font: "inherit",
                        cursor: "pointer",
                      }}
                      title={
                        active
                          ? "Clear the selection"
                          : "Only rows with views here, sorted by them"
                      }
                      type="button"
                    >
                      {label(col, colAxis, true)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map(([row, total]) => {
              const focus = activeCol ? cell(row, activeCol) : undefined;
              return (
                <tr key={row}>
                  <td
                    style={{
                      padding: "4px 6px",
                      maxWidth: 260,
                      borderTop: "1px solid var(--theme-elevation-100)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        {label(row, rowAxis, false)}
                        <span
                          style={{
                            ...muted,
                            display: "block",
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {focus ? (
                            <>
                              <strong style={{ color: "var(--theme-text)" }}>
                                {focus.count}
                              </strong>{" "}
                              of {total.count} · last{" "}
                              <strong style={{ color: "var(--theme-text)" }}>
                                {stamp(focus.lastAt)}
                              </strong>
                            </>
                          ) : (
                            <>
                              {total.count} · last {stamp(total.lastAt)}
                            </>
                          )}
                        </span>
                      </div>
                      {rowAxis === "device" && deleteButton(row, true)}
                    </div>
                  </td>
                  {columns.map((col) => {
                    const value = cell(row, col);
                    const isHovered =
                      hover?.kind === "cell" &&
                      hover.row === row &&
                      hover.col === col;
                    return (
                      <td
                        key={col}
                        onMouseEnter={() =>
                          setHover({ kind: "cell", row, col })
                        }
                        style={{
                          height: CELL,
                          padding: 2,
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <Bubble
                          count={value?.count ?? 0}
                          hovered={isHovered}
                          max={max}
                          shade={value ? shade(value.count) : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...muted, ...footCell, padding: "6px 6px 4px" }}>
                {visits.length} in total
                <br />
                per column · last
              </td>
              {columns.map((col) => {
                const total = columnTotal(col);
                return (
                  <td
                    key={col}
                    style={{
                      ...muted,
                      ...footCell,
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {total ? (
                      <>
                        <strong style={{ color: "var(--theme-text)" }}>
                          {total.count}
                        </strong>
                        <br />
                        {stamp(total.lastAt)}
                      </>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* A line kept free: appearing only on hover, it would make the grid
          below jump with every move. */}
      <p style={{ ...muted, fontSize: 12, margin: "6px 0 0", minHeight: 18 }}>
        {readout ??
          (activeCol
            ? "Under each name: views and last view in the selected column."
            : "Point at a cell for count and last view – click a column header to see only that column.")}
      </p>

      {rows.length > MAX_ROWS && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginTop: 6,
            border: "none",
            background: "none",
            color: "var(--theme-elevation-500)",
            font: "inherit",
            fontSize: 12,
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
          type="button"
        >
          {expanded
            ? "Show less"
            : `Show all ${noun(rowAxis)} (${rows.length})`}
        </button>
      )}
    </div>
  );
};
