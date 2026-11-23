"use client";

import { TRACKING } from "../../stats/config";
import { journeysOf } from "../../stats/journeys";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import {
  BarList,
  barTable,
  ChartCard,
  deviceSlices,
  pageSlices,
  Ring,
} from "./charts";
import { inWindow, rangeWindow, setFocus, useAnalytics } from "./data";
import { fmt, Loading, Note, ResetChip } from "./parts";
import { VisitBrowser } from "./visit-browser";

/**
 * Who opened what – on which devices, and where they came from. In the
 * range from the sidebar, the same as in Overview, so the numbers here add
 * up to those there. The hour or day chosen in the chart narrows down
 * (`focus`).
 *
 * The pages as a ring – a slice per page and language: the site has only
 * the editor and the card, so a grid of pages against visitors or paths
 * through the site would say less than this. With `TRACKING.visits` the
 * visitors follow as a list (made-up names from the random visit id) – a
 * click opens one.
 */
export const AnalyticsVisitors = () => {
  const { data, range, focus } = useAnalytics();
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const views = data.views.filter(inRange);

  // With `visits`: the views as visits – only those with a visit id. Older
  // ones stay in the counts above, but have no visitor.
  const journeys = TRACKING.visits
    ? journeysOf(
        views.filter((row) => row.visit),
        pathLabel
      )
    : [];

  // Sources without internal navigation – it says nothing about where people
  // came from and would dwarf everything else.
  const sources = tally(
    views.filter((r) => r.referrer !== "internal").map((r) => r.referrer)
  ).map(([name, value]) => ({ name, value }));
  const pages = pageSlices(views.map((row) => row.path));
  const devices = deviceSlices(views.map((row) => row.device));
  // The campaign (`TRACKING.campaigns`) only where the first page had one.
  const campaigns = tally(
    views.filter((row) => row.campaign).map((row) => row.campaign)
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="stats-viz">
      {focus ? (
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span style={{ color: "var(--theme-elevation-800)", fontSize: 13 }}>
            Only <strong>{focus.label}</strong> (from the chart) ·{" "}
            {fmt(views.length)} page views
          </span>
          <ResetChip
            onReset={() => setFocus(null)}
            title={`Back to the whole range (${w.label})`}
          />
        </div>
      ) : null}

      {views.length === 0 ? (
        <Note>No page views in this time range.</Note>
      ) : (
        <>
          <div className="stats-viz__grid">
            <ChartCard
              table={{
                head: ["Page", "Page views"],
                rows: pages.map((slice) => [slice.name, slice.value]),
              }}
              title="Pages"
            >
              <Ring slices={pages} unit="page views" />
            </ChartCard>
            <ChartCard
              table={{
                head: ["Device", "Page views"],
                rows: devices.map((slice) => [slice.name, slice.value]),
              }}
              title="Devices"
            >
              <Ring slices={devices} unit="page views" />
            </ChartCard>
          </div>
          <ChartCard
            aside="without internal navigation"
            table={barTable(sources, "Source")}
            title="Sources"
          >
            <BarList entries={sources} />
          </ChartCard>
          {TRACKING.campaigns && (
            <ChartCard
              aside="source · medium · campaign"
              table={barTable(campaigns, "Campaign")}
              title="Campaigns"
            >
              <BarList entries={campaigns} />
            </ChartCard>
          )}
          {journeys.length > 0 && (
            <ChartCard aside="click one for the path" title="Visitors">
              <VisitBrowser journeys={journeys} />
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
};
