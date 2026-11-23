"use client";

import { TRACKING } from "../../stats/config";
import { type Journey, journeysOf } from "../../stats/journeys";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import { deviceName, type Visit } from "../../stats/visit-matrix";
import { countryFlag } from "../../stats/visit-name";
import { VisitMatrix } from "../visit-matrix";
import { BarList, barTable, ChartCard, deviceSlices, Ring } from "./charts";
import {
  deviceRows,
  inWindow,
  rangeWindow,
  resetDevice,
  resetVisit,
  setFocus,
  useAnalytics,
} from "./data";
import { fmt, Loading, Note, ResetChip } from "./parts";
import { VisitBrowser } from "./visit-browser";

/**
 * Who opened what – on which devices, and where they came from. In the
 * range from the sidebar, the same as in Overview, so the numbers here add
 * up to those there. The hour or day chosen in the chart narrows down
 * (`focus`).
 *
 * With `TRACKING.visits` the grid is pages × visitors (made-up names from
 * the random visit id) and the visitors follow as a list – a click opens
 * one with its path. Without, pages × device profiles.
 */
export const AnalyticsVisitors = () => {
  const { data, busy, range, focus } = useAnalytics();
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const views = data.views.filter(inRange);

  // With `visits`: the views as visits – only those with a visit id. Older
  // ones stay in the counts above, but have no visitor to stand under.
  const tracked = TRACKING.visits ? views.filter((row) => row.visit) : [];
  const journeys = journeysOf(tracked, pathLabel);
  const untracked = views.length - tracked.length;

  // A visitor as a column header: the made-up name on top, device class and
  // country below – the grid and the list say the same names.
  const columnOf = (journey: Journey) =>
    [
      journey.name,
      journey.deviceClass,
      journey.country
        ? `${countryFlag(journey.country)} ${journey.country}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const visitOf = new Map<string, string>();
  const columnByVisit = new Map<string, string>();
  for (const journey of journeys) {
    const column = columnOf(journey);
    visitOf.set(column, journey.key);
    columnByVisit.set(journey.key, column);
  }

  // Every view as a pair of page and column – the matrix builds both
  // directions from it. Without `visits` the column is the device profile:
  // class, system and browser in ONE name – counted apart, “62 % mobile”
  // and “58 % Safari” could not be told to be the same views or not.
  const visits: Visit[] = TRACKING.visits
    ? tracked.map((row) => ({
        page: row.path || "—",
        device: columnByVisit.get(row.visit as string) ?? "—",
        at: new Date(row.createdAt).getTime(),
      }))
    : views.map((row) => ({
        page: row.path || "—",
        device: deviceName(row),
        at: new Date(row.createdAt).getTime(),
      }));

  // Sources without internal navigation – it says nothing about where people
  // came from and would dwarf everything else.
  const sources = tally(
    views.filter((r) => r.referrer !== "internal").map((r) => r.referrer)
  ).map(([name, value]) => ({ name, value }));
  const devices = deviceSlices(views.map((row) => row.device));
  // The campaign (`TRACKING.campaigns`) only where the first page had one.
  const campaigns = tally(
    views.filter((row) => row.campaign).map((row) => row.campaign)
  ).map(([name, value]) => ({ name, value }));

  // Deletes all views of a device profile – one's own devices from before
  // “Own devices”. Over everything kept, not just the range: a half-deleted
  // device would be worse than none.
  const onResetDevice = (device: string) => {
    const total = deviceRows(device).length;
    if (!total) return;
    if (
      window.confirm(
        `Delete all ${fmt(total)} page views of "${device}" (everything kept)? This cannot be undone.`
      )
    ) {
      resetDevice(device);
    }
  };

  // Deletes one visitor's views – one's own visit before “Own devices”.
  const onResetVisitor = (column: string) => {
    const visit = visitOf.get(column);
    if (!visit) return;
    const count = tracked.filter((row) => row.visit === visit).length;
    if (
      window.confirm(
        `Delete the ${fmt(count)} page views of "${column.split(" · ")[0]}"? This cannot be undone.`
      )
    ) {
      resetVisit(visit);
    }
  };

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
                head: ["Device", "Page views"],
                rows: devices.map((slice) => [slice.name, slice.value]),
              }}
              title="Devices"
            >
              <Ring slices={devices} unit="page views" />
            </ChartCard>
            <ChartCard
              aside="without internal navigation"
              table={barTable(sources, "Source")}
              title="Sources"
            >
              <BarList entries={sources} />
            </ChartCard>
          </div>
          {TRACKING.campaigns && (
            <ChartCard
              aside="source · medium · campaign"
              table={barTable(campaigns, "Campaign")}
              title="Campaigns"
            >
              <BarList entries={campaigns} />
            </ChartCard>
          )}
          {TRACKING.visits ? (
            <>
              <ChartCard
                aside={
                  untracked > 0
                    ? `${fmt(untracked)} older page views have no visitor`
                    : undefined
                }
                title="Pages × visitors"
              >
                <VisitMatrix
                  busy={busy}
                  columnNoun={{ one: "visitor", many: "visitors" }}
                  maxColumns={8}
                  onResetDevice={onResetVisitor}
                  otherInMax={false}
                  swappable={false}
                  visits={visits}
                />
              </ChartCard>
              <ChartCard aside="click one for the path" title="Visitors">
                <VisitBrowser journeys={journeys} />
              </ChartCard>
            </>
          ) : (
            <ChartCard title="Pages × devices">
              <VisitMatrix
                busy={busy}
                onResetDevice={onResetDevice}
                visits={visits}
              />
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
};
