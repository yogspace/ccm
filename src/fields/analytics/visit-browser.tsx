"use client";

import { Fragment, type KeyboardEvent, useRef, useState } from "react";
import { LOCALE, TRACKING } from "../../stats/config";
import { atlasKey, countryName, languageName } from "../../stats/country-codes";
import type { Journey } from "../../stats/journeys";
import { countryFlag } from "../../stats/visit-name";
import { CountryMap } from "./geo-map";
import { Overlay, VisitTimeline } from "./journey-overlay";
import { duration, fmt, INK, MUTED } from "./parts";

/**
 * The visitors (`TRACKING.visits`) as a scrollable list, newest first and
 * grouped by day, under made-up names – device, place, when and how many
 * pages at a glance. A click opens an overlay with the short profile (the
 * facts beside the country on a map) and the visitor's path page by page.
 * Arrow keys walk the list.
 *
 * A visit is one tab's random id: no person behind it can be recognised, and
 * the same person is a new visit – with a new name – after a reload.
 */

const stamp = (t: number) =>
  new Date(t).toLocaleString(LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const clock = (t: number) =>
  new Date(t).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });

/** The calendar day of a moment – for the day headings in the list. */
const dayOf = (t: number) => new Date(t).toDateString();

/** “Today”, “Yesterday”, else the date (“Fr., 13.11.”). */
const dayLabel = (t: number) => {
  const day = new Date(t);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yesterday.toDateString()) return "Yesterday";
  return day.toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

const when = (journey: Journey) =>
  clock(journey.end) === clock(journey.start)
    ? stamp(journey.start)
    : `${stamp(journey.start)} – ${clock(journey.end)}`;

const pagesOf = (journey: Journey) =>
  `${journey.steps.length} ${journey.steps.length === 1 ? "page" : "pages"}`;

/** “🇩🇪 Germany” – null without a location (`TRACKING.origin`). */
const country = (journey: Journey) =>
  journey.country
    ? `${countryFlag(journey.country)} ${countryName(journey.country)}`.trim()
    : null;

/** “🇩🇪 Munich, Bavaria, Germany” – as fine as it was stored. */
const place = (journey: Journey) =>
  journey.country
    ? `${countryFlag(journey.country)} ${[
        journey.city,
        journey.region,
        countryName(journey.country),
      ]
        .filter(Boolean)
        .join(", ")}`.trim()
    : null;

/** The list's place column: the city where there is one, else the country. */
const shortPlace = (journey: Journey) =>
  journey.country
    ? `${countryFlag(journey.country)} ${journey.city || countryName(journey.country)}`.trim()
    : null;

/** Avatars in the darker half of the ramp, picked by the name. */
const AVATAR_STEPS = [3, 4, 5, 6] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .join("");

export const Avatar = ({ name, size }: { name: string; size: number }) => {
  const shade =
    AVATAR_STEPS[
      [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) %
        AVATAR_STEPS.length
    ];
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        background: `var(--viz-seq-${shade})`,
        borderRadius: 999,
        color: `var(--viz-seq-ink-${shade})`,
        display: "inline-flex",
        flexShrink: 0,
        fontSize: size * 0.38,
        fontWeight: 600,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {initials(name)}
    </span>
  );
};

/** Neighbouring pages in a visit's dots tell apart by their step of the ramp. */
const DOT_STEPS = [4, 2, 5, 3, 6] as const;

/** A visit's pages as a row of dots – the length of the path at a glance. */
const PathDots = ({ journey }: { journey: Journey }) => (
  <span
    aria-hidden="true"
    style={{ alignItems: "center", display: "inline-flex", gap: 3 }}
  >
    {journey.steps.slice(0, 12).map((step, i) => (
      <span
        key={`${step.at}-${i.toString()}`}
        style={{
          background: `var(--viz-seq-${DOT_STEPS[i % DOT_STEPS.length]})`,
          borderRadius: 999,
          height: 6,
          width: 6,
        }}
      />
    ))}
    {journey.steps.length > 12 && (
      <span style={{ color: MUTED, fontSize: 10, lineHeight: 1 }}>+</span>
    )}
  </span>
);

/** The facts that aren't in the overlay's head already – as small tiles. */
const facts = (journey: Journey): [string, string][] =>
  (
    [
      ["Language", journey.language ? languageName(journey.language) : null],
      ["Device", journey.deviceClass],
      ["System", journey.os],
      ["Browser", journey.browser],
      ["Came from", journey.source],
      [
        "Time on site",
        TRACKING.timing && journey.timed ? duration(journey.seconds) : null,
      ],
    ] as [string, string | null][]
  ).filter((row): row is [string, string] => Boolean(row[1]));

/**
 * One visitor in the overlay: on the left the facts as tiles with the
 * country's map below, on the right the path – it gets the height. Name,
 * country and time stand in the overlay's head.
 */
const VisitorDetail = ({ journey }: { journey: Journey }) => {
  const mapKey = journey.country ? atlasKey(journey.country) : null;
  return (
    <div className="stats-viz__visitor">
      <div className="stats-viz__visitor-about">
        <dl className="stats-viz__facts">
          {facts(journey).map(([label, value]) => (
            <div className="stats-viz__fact" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {mapKey && (
          <CountryMap
            countryKey={mapKey}
            height={160}
            label={country(journey)}
          />
        )}
      </div>
      <section className="stats-viz__visitor-path">
        <h4 className="stats-viz__eyebrow">Path · {pagesOf(journey)}</h4>
        <VisitTimeline journey={journey} />
      </section>
    </div>
  );
};

/** A visitor's overlay. */
export const VisitorOverlay = ({
  journey,
  onClose,
}: {
  journey: Journey;
  onClose: () => void;
}) => (
  <Overlay
    icon={<Avatar name={journey.name} size={44} />}
    maxWidth={860}
    onClose={onClose}
    subtitle={[place(journey), when(journey)].filter(Boolean).join(" · ")}
    title={journey.name}
  >
    <VisitorDetail journey={journey} />
  </Overlay>
);

/** The device line below a name: class, system, browser, where from. */
const deviceLine = (journey: Journey) =>
  [
    journey.deviceClass,
    journey.os,
    journey.browser,
    journey.source && journey.source !== "—" ? `from ${journey.source}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** A visitor opened inside another overlay: back link, head, then detail. */
const InlineVisitor = ({
  journey,
  back,
  onBack,
}: {
  journey: Journey;
  back: string;
  onBack: () => void;
}) => (
  <div>
    <button className="stats-viz__back" onClick={onBack} type="button">
      ← {back}
    </button>
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 14,
        margin: "14px 0 20px",
      }}
    >
      <Avatar name={journey.name} size={40} />
      <span style={{ display: "grid", gap: 3 }}>
        <span style={{ color: INK, fontSize: 17, fontWeight: 600 }}>
          {journey.name}
        </span>
        <span style={{ color: MUTED, fontSize: 13 }}>{when(journey)}</span>
      </span>
    </div>
    <VisitorDetail journey={journey} />
  </div>
);

export const VisitBrowser = ({
  journeys,
  within,
}: {
  journeys: Journey[];
  /**
   * Shown inside an overlay that already names the country (Locations): no
   * country column, no frame of its own, and a visitor opens in place – with
   * a way back named `within` – instead of a second overlay on top.
   */
  within?: string;
}) => {
  // The row the arrow keys are on, and the visitor whose overlay is open.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const index = Math.max(
    0,
    journeys.findIndex((journey) => journey.key === focusKey)
  );
  const current = journeys[index];
  const opened = journeys.find((journey) => journey.key === openKey);

  if (within && opened) {
    return (
      <InlineVisitor
        back={within}
        journey={opened}
        onBack={() => {
          setOpenKey(null);
          // Back on the row the visitor was opened from.
          requestAnimationFrame(() =>
            list.current
              ?.querySelector<HTMLButtonElement>(`[data-visit="${opened.key}"]`)
              ?.focus()
          );
        }}
      />
    );
  }

  if (!current) {
    return (
      <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
        No visitors in this time range.
      </p>
    );
  }

  const move = (next: number) => {
    const journey = journeys[Math.min(journeys.length - 1, Math.max(0, next))];
    setFocusKey(journey.key);
    list.current
      ?.querySelector<HTMLButtonElement>(`[data-visit="${journey.key}"]`)
      ?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const step =
      event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowUp"
          ? -1
          : event.key === "Home"
            ? -journeys.length
            : event.key === "End"
              ? journeys.length
              : 0;
    if (!step) return;
    event.preventDefault();
    move(index + step);
  };

  return (
    <>
      <ul
        aria-label={`${fmt(journeys.length)} visitors`}
        className={
          within
            ? "stats-viz__visit-list stats-viz__visit-list--within"
            : TRACKING.origin
              ? "stats-viz__visit-list"
              : "stats-viz__visit-list stats-viz__visit-list--no-place"
        }
        onKeyDown={onKeyDown}
        ref={list}
      >
        {journeys.map((journey, i) => (
          <Fragment key={journey.key}>
            {(i === 0 ||
              dayOf(journeys[i - 1].start) !== dayOf(journey.start)) && (
              <li aria-hidden="true" className="stats-viz__visit-day">
                {dayLabel(journey.start)}
              </li>
            )}
            <li>
              <button
                aria-haspopup={within ? undefined : "dialog"}
                className="stats-viz__visit-item"
                data-visit={journey.key}
                onClick={() => {
                  setFocusKey(journey.key);
                  setOpenKey(journey.key);
                }}
                onFocus={() => setFocusKey(journey.key)}
                // One tab stop for the whole list – the arrows do the rest.
                tabIndex={journey.key === current.key ? 0 : -1}
                type="button"
              >
                <span className="stats-viz__visit-when">
                  {clock(journey.start)}
                </span>
                <Avatar name={journey.name} size={30} />
                <span className="stats-viz__visit-who">
                  <span
                    style={{
                      color: INK,
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {journey.name}
                  </span>
                  <span
                    style={{
                      color: MUTED,
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deviceLine(journey)}
                  </span>
                </span>
                {!within && TRACKING.origin && (
                  <span
                    className="stats-viz__visit-where"
                    title={place(journey) ?? undefined}
                  >
                    {shortPlace(journey) ?? "—"}
                  </span>
                )}
                <span className="stats-viz__visit-path">
                  <PathDots journey={journey} />
                  <span className="stats-viz__visit-pages">
                    {pagesOf(journey)}
                  </span>
                </span>
              </button>
            </li>
          </Fragment>
        ))}
      </ul>
      {opened && !within && (
        <VisitorOverlay journey={opened} onClose={() => setOpenKey(null)} />
      )}
    </>
  );
};
