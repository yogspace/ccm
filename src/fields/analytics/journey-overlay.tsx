"use client";

import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { LOCALE, TRACKING } from "../../stats/config";
import { type Journey, pathSteps } from "../../stats/journeys";
import { tally } from "../../stats/tally";
import { useWidth } from "./charts";
import { duration, fmt, INK, LINE, MUTED, TEXT } from "./parts";

/**
 * The overlays of the analytics global: a native dialog – Escape and the
 * backdrop close it, focus stays inside. In it the paths through the site
 * as steps (`TRACKING.visits`) – the pages of the first, second, third …
 * page of a visit, the ways between them as bands as wide as they were
 * taken – or one visit from its first page to its last.
 */

export const Overlay = ({
  title,
  aside,
  onClose,
  maxWidth,
  icon,
  subtitle,
  children,
}: PropsWithChildren<{
  title: string;
  aside?: ReactNode;
  /** Before the title – an avatar, a flag. */
  icon?: ReactNode;
  /** A line below the title. */
  subtitle?: ReactNode;
  onClose: () => void;
  /** Narrower than the default 1280 px – a profile rather than a diagram. */
  maxWidth?: number;
}>) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  return (
    <dialog
      aria-label={title}
      className="stats-viz__dialog"
      // React's development mode mounts twice: the first unmount closes the
      // dialog, and its “close” event only arrives once it is open again. So
      // only a dialog that is really closed (Escape) counts.
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      // A click on the backdrop lands on the dialog itself.
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialog}
      style={
        maxWidth
          ? { maxWidth: `min(${maxWidth}px, calc(100vw - 32px))` }
          : undefined
      }
    >
      <div className="stats-viz__dialog-body">
        <header
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 16px",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              alignItems: "center",
              display: "flex",
              gap: 14,
              minWidth: 0,
            }}
          >
            {icon}
            <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
              <h3
                style={{ color: INK, fontSize: 20, fontWeight: 600, margin: 0 }}
              >
                {title}
              </h3>
              {subtitle && (
                <span style={{ color: MUTED, fontSize: 13 }}>{subtitle}</span>
              )}
            </span>
          </span>
          <span
            style={{
              alignItems: "center",
              color: MUTED,
              display: "inline-flex",
              flexWrap: "wrap",
              fontSize: 12,
              gap: 12,
            }}
          >
            {aside}
            <button
              aria-label="Close"
              onClick={onClose}
              style={{
                background: "none",
                border: `1px solid ${LINE}`,
                borderRadius: 999,
                color: TEXT,
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                padding: "3px 12px",
              }}
              type="button"
            >
              ✕ Close
            </button>
          </span>
        </header>
        {children}
      </div>
    </dialog>
  );
};

// ─── All paths ───────────────────────────────────────────────────────────────

const NODE_H = 52;
const NODE_GAP = 10;
const COL_GAP = 72;
const MIN_COL = 190;

type Node = { name: string; count: number; y: number };

/**
 * The paths as steps: a column per step, its pages by how many visits had
 * them there, the bands between as wide as the way was taken. A click on a
 * page follows only the visits that passed it there – before and after.
 */
export const JourneyFlow = ({ journeys }: { journeys: Journey[] }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [steps, setSteps] = useState(4);
  const [picked, setPicked] = useState<{ col: number; name: string } | null>(
    null
  );

  // Columns, “Other” and the ways between – the same as the mail report's
  // paths picture (stats/journeys.ts).
  const flow = pathSteps(journeys, steps);
  const { nodeOf } = flow;
  const through = picked
    ? journeys.filter(
        (j) =>
          j.pages.length > picked.col && nodeOf(j, picked.col) === picked.name
      )
    : journeys;

  const columns = flow.columns.map((column, col) => {
    const followed = new Map(
      tally(
        through.filter((j) => j.pages.length > col).map((j) => nodeOf(j, col))
      )
    );
    return {
      total: column.total,
      nodes: column.nodes.map(
        (node, i): Node & { ended: number; followed: number } => ({
          ...node,
          y: i * (NODE_H + NODE_GAP),
          followed: followed.get(node.name) ?? 0,
        })
      ),
    };
  });

  const colW = Math.max(
    MIN_COL,
    (width - COL_GAP * (columns.length - 1)) / Math.max(1, columns.length)
  );
  const fullW = columns.length * colW + (columns.length - 1) * COL_GAP;
  const height =
    Math.max(1, ...columns.map((column) => column.nodes.length)) *
      (NODE_H + NODE_GAP) -
    NODE_GAP;
  const xOf = (col: number) => col * (colW + COL_GAP);
  const yOf = (col: number, name: string) =>
    (columns[col]?.nodes.find((node) => node.name === name)?.y ?? 0) +
    NODE_H / 2;

  // The ways between two steps – all, and those of the picked visits.
  const linkKey = (link: { col: number; from: string; to: string }) =>
    `${link.col}\u001f${link.from}\u001f${link.to}`;
  const followedLinks = new Map(
    flow.linksOf(through).map((link) => [linkKey(link), link.count])
  );
  const links = flow.links.map((link) => ({
    ...link,
    followed: followedLinks.get(linkKey(link)) ?? 0,
  }));
  const maxLink = Math.max(1, ...links.map((link) => link.count));

  if (journeys.length === 0) {
    return (
      <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
        No visits in this time range.
      </p>
    );
  }

  return (
    <>
      <div
        style={{
          alignItems: "center",
          color: MUTED,
          display: "flex",
          flexWrap: "wrap",
          fontSize: 12,
          gap: 10,
          marginBottom: 14,
        }}
      >
        Steps
        {[3, 4, 5, 6].map((n) => (
          <button
            aria-pressed={steps === n}
            key={n}
            onClick={() => {
              setSteps(n);
              setPicked(null);
            }}
            style={{
              background: steps === n ? "var(--theme-elevation-100)" : "none",
              border: `1px solid ${LINE}`,
              borderRadius: 999,
              color: TEXT,
              cursor: "pointer",
              font: "inherit",
              fontSize: 11,
              fontWeight: steps === n ? 600 : 400,
              padding: "2px 10px",
            }}
            type="button"
          >
            {n}
          </button>
        ))}
        <span>
          {picked
            ? `Only the ${fmt(through.length)} visits through “${picked.name}” at step ${picked.col + 1} – click it again for all.`
            : "Click a page to follow only the visits through it."}
        </span>
      </div>
      <div ref={ref} style={{ overflowX: "auto", paddingBottom: 6 }}>
        <div style={{ display: "flex", gap: COL_GAP, width: fullW }}>
          {columns.map((column, col) => (
            <div
              key={`head-${col.toString()}`}
              style={{ color: MUTED, fontSize: 11, width: colW }}
            >
              <strong style={{ color: TEXT, fontWeight: 600 }}>
                Step {col + 1}
              </strong>{" "}
              · {fmt(column.total)} visits
            </div>
          ))}
        </div>
        <div
          style={{
            height,
            marginTop: 10,
            position: "relative",
            width: fullW,
          }}
        >
          <svg
            aria-hidden="true"
            height={height}
            style={{ left: 0, position: "absolute", top: 0 }}
            width={fullW}
          >
            {links.map((link) => {
              const x1 = xOf(link.col) + colW;
              const x2 = xOf(link.col + 1);
              const y1 = yOf(link.col, link.from);
              const y2 = yOf(link.col + 1, link.to);
              const mid = (x1 + x2) / 2;
              const shown = picked ? link.followed : link.count;
              return (
                <g key={`${link.col}-${link.from}-${link.to}`}>
                  <path
                    d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="var(--viz-1)"
                    strokeOpacity={picked ? 0.07 : 0.22}
                    strokeWidth={Math.max(1.5, (link.count / maxLink) * 18)}
                  />
                  {picked && shown > 0 && (
                    <path
                      d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke="var(--viz-1)"
                      strokeOpacity={0.55}
                      strokeWidth={Math.max(1.5, (shown / maxLink) * 18)}
                    />
                  )}
                </g>
              );
            })}
          </svg>
          {columns.map((column, col) =>
            column.nodes.map((node) => {
              const on = picked?.col === col && picked.name === node.name;
              const faded = picked !== null && node.followed === 0;
              const shown = picked ? node.followed : node.count;
              return (
                <button
                  aria-pressed={on}
                  key={`${col.toString()}-${node.name}`}
                  onClick={() =>
                    setPicked(on ? null : { col, name: node.name })
                  }
                  style={{
                    background: on
                      ? "var(--viz-select)"
                      : "var(--theme-elevation-50)",
                    border: `1px solid ${on ? "var(--viz-1)" : "var(--theme-elevation-150)"}`,
                    borderRadius: "var(--style-radius-m)",
                    color: TEXT,
                    cursor: "pointer",
                    display: "grid",
                    font: "inherit",
                    gap: 2,
                    height: NODE_H,
                    left: xOf(col),
                    opacity: faded ? 0.35 : 1,
                    padding: "6px 10px",
                    position: "absolute",
                    textAlign: "left",
                    top: node.y,
                    width: colW,
                  }}
                  title={`${node.name} – ${fmt(node.count)} visits at step ${col + 1}, ${fmt(node.ended)} ended here`}
                  type="button"
                >
                  <span
                    style={{
                      display: "flex",
                      fontSize: 12,
                      gap: 8,
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {node.name}
                    </span>
                    <strong
                      style={{ color: INK, fontVariantNumeric: "tabular-nums" }}
                    >
                      {fmt(shown)}
                    </strong>
                  </span>
                  <span style={{ color: MUTED, fontSize: 11 }}>
                    {Math.round((node.count / column.total) * 100)} %
                    {node.ended > 0 &&
                      ` · ${Math.round((node.ended / node.count) * 100)} % left`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

// ─── One visit ───────────────────────────────────────────────────────────────

const clock = (t: number) =>
  new Date(t).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * One visit, page by page: numbered steps joined by a line, the page's name
 * (its path below) and the time it was opened on the right. With
 * `TRACKING.timing` also how long it was visible and when it was left.
 */
export const VisitTimeline = ({ journey }: { journey: Journey }) => (
  <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
    {journey.steps.map((step, i) => {
      const last = i === journey.steps.length - 1;
      const time =
        TRACKING.timing && step.seconds !== null
          ? [
              `${duration(step.seconds)} visible`,
              step.end ? `left ${clock(step.end)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : null;
      return (
        <li
          key={`${step.at}-${i.toString()}`}
          style={{
            display: "grid",
            gap: "0 14px",
            gridTemplateColumns: "24px minmax(0, 1fr) auto",
            minHeight: last ? undefined : 48,
            position: "relative",
          }}
        >
          {!last && (
            <span
              aria-hidden="true"
              style={{
                background: "var(--theme-elevation-150)",
                bottom: 0,
                left: 11,
                position: "absolute",
                top: 24,
                width: 2,
              }}
            />
          )}
          <span
            aria-hidden="true"
            style={{
              alignItems: "center",
              background: i === 0 ? "var(--viz-1)" : "var(--theme-elevation-0)",
              border: "2px solid var(--viz-1)",
              borderRadius: 999,
              color: i === 0 ? "var(--theme-elevation-0)" : "var(--viz-1)",
              display: "flex",
              fontSize: 11,
              fontWeight: 700,
              height: 24,
              justifyContent: "center",
              position: "relative",
              width: 24,
            }}
          >
            {i + 1}
          </span>
          <span
            style={{
              display: "grid",
              gap: 1,
              minWidth: 0,
              paddingBottom: last ? 0 : 12,
              paddingTop: 2,
            }}
          >
            <strong style={{ color: INK, fontSize: 14, fontWeight: 600 }}>
              {step.label}
            </strong>
            {step.label !== step.path && (
              <span style={{ color: MUTED, fontSize: 12 }}>{step.path}</span>
            )}
            {time && (
              <span
                style={{
                  color: TEXT,
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {time}
              </span>
            )}
          </span>
          <span
            style={{
              color: MUTED,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              paddingTop: 4,
            }}
          >
            {clock(step.at)}
          </span>
        </li>
      );
    })}
  </ol>
);
