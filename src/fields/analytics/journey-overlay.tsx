"use client";

import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { LOCALE, TRACKING } from "../../stats/config";
import type { Journey } from "../../stats/journeys";
import { duration, INK, LINE, MUTED, TEXT } from "./parts";

/**
 * The overlays of the analytics global: a native dialog – Escape and the
 * backdrop close it, focus stays inside. In it one visit from its first
 * page to its last (visit-browser.tsx) or a country's visitors
 * (locations.tsx).
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
