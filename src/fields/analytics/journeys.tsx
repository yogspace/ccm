"use client";

import { useState } from "react";
import { TRACKING } from "../../stats/config";
import { journeysOf } from "../../stats/journeys";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import { type BarEntry, BarList, barTable, ChartCard } from "./charts";
import { inWindow, rangeWindow, useAnalytics, type ViewRow } from "./data";
import { JourneyFlow, Overlay } from "./journey-overlay";
import { duration, fmt, Loading, MUTED, median, Note } from "./parts";

/**
 * How people move through the site and for how long (stats/config.ts):
 * with `visits` all paths as steps in ONE diagram – where visits start, the
 * ways on, where they end; with `timing` the visible time on each page and
 * by device. How many visitors, pages per visitor and the time tiles stand
 * in Overview, the single visitors in Visitors – not repeated here. In the
 * range from the sidebar, or the hour or day chosen in the chart.
 */

const entries = (values: string[]): BarEntry[] =>
  tally(values).map(([name, value]) => ({ name, value }));

/** The median time per name – the most frequent first. */
const timeBy = (pairs: [string, number][]): BarEntry[] => {
  const by = new Map<string, number[]>();
  for (const [name, seconds] of pairs) {
    const list = by.get(name);
    if (list) list.push(seconds);
    else by.set(name, [seconds]);
  }
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, list]) => ({
      name,
      value: median(list),
      title: `${name} – median of ${fmt(list.length)}`,
    }));
};

const durationTable = (list: BarEntry[], what: string) => ({
  head: [what, "Median"],
  rows: list.map((entry) => [entry.title ?? entry.name, duration(entry.value)]),
});

export const AnalyticsJourneys = () => {
  const { data, range, focus } = useAnalytics();
  const [showPaths, setShowPaths] = useState(false);
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  // Only views recorded with the options on – older ones have no id.
  const tracked = (row: ViewRow) => Boolean(row.view || row.visit);
  const views = data.views.filter(inRange).filter(tracked);
  const journeys = journeysOf(views, pathLabel);
  // The paths: visits with an id only – a single page view is no path.
  const visits = TRACKING.visits
    ? journeysOf(
        views.filter((row) => row.visit),
        pathLabel
      )
    : [];
  // The paths as a table too – the card's “Table” for the diagram.
  const paths = entries(
    visits.map(
      (j) =>
        j.pages.slice(0, 4).join(" → ") + (j.pages.length > 4 ? " → …" : "")
    )
  );

  const timedViews = views.filter((row) => typeof row.seconds === "number");
  const pageTimes = timeBy(
    timedViews.map((row) => [pathLabel(row.path || "—"), row.seconds ?? 0])
  );
  const deviceTimes = timeBy(
    journeys
      .filter((journey) => journey.timed)
      .map((journey) => [journey.device, journey.seconds])
  );

  const empty =
    visits.length === 0 && !(TRACKING.timing && timedViews.length > 0);

  return (
    <div className="stats-viz">
      {empty ? (
        <Note>
          Nothing in this time range – recorded only since the options in
          stats/config.ts are on.
        </Note>
      ) : (
        <>
          {visits.length > 0 && (
            <ChartCard
              aside={
                <button
                  onClick={() => setShowPaths(true)}
                  style={{
                    background: "none",
                    border: "1px solid var(--theme-elevation-150)",
                    borderRadius: 999,
                    color: "var(--theme-elevation-800)",
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 12,
                    padding: "3px 12px",
                  }}
                  type="button"
                >
                  Open large
                </button>
              }
              table={barTable(paths, "Path")}
              title="Paths through the site"
            >
              <p
                style={{
                  color: MUTED,
                  fontSize: 12,
                  lineHeight: 1.45,
                  margin: "0 0 12px",
                }}
              >
                Each column is a step of a visit: the first column shows where
                visits start, the bands how they go on – the wider, the more
                often. “% left” is how many ended on that page.
              </p>
              <JourneyFlow journeys={visits} />
            </ChartCard>
          )}

          {TRACKING.timing && timedViews.length > 0 && (
            <div className="stats-viz__grid">
              <ChartCard
                aside="median · a hidden tab does not count"
                table={durationTable(pageTimes, "Page")}
                title="Time on each page"
              >
                <BarList entries={pageTimes} format={duration} />
              </ChartCard>
              <ChartCard
                aside={TRACKING.visits ? "median per visit" : "median per page"}
                table={durationTable(deviceTimes, "Device")}
                title="Time by device"
              >
                <BarList entries={deviceTimes} format={duration} />
              </ChartCard>
            </div>
          )}

          {showPaths && (
            <Overlay
              onClose={() => setShowPaths(false)}
              title="Paths through the site"
            >
              <JourneyFlow journeys={visits} />
            </Overlay>
          )}
        </>
      )}
    </div>
  );
};
