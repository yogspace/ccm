"use client";

import {
  ACTION_NAMES,
  type ActionName,
  actionLabel,
} from "../../stats/actions";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import {
  type BarEntry,
  BarList,
  barTable,
  ChartCard,
  deviceSlices,
  Key,
  Ring,
} from "./charts";
import { inWindow, rangeWindow, useAnalytics } from "./data";
import { fmt, Loading, MUTED, Note, TEXT } from "./parts";

/** The actions by what they are about – anything new lands in “Other”. */
const GROUPS: { title: string; names: ActionName[] }[] = [
  { title: "Making", names: ["cookie-saved", "template", "svg-import"] },
  {
    title: "Downloads",
    names: ["download-3mf", "download-stl", "download-embossed"],
  },
  {
    title: "Sharing",
    names: ["share-open", "share-link", "share-image", "save-image"],
  },
  {
    title: "Cards",
    names: [
      "card-created",
      "card-turned",
      "card-eaten",
      "card-picture",
      "card-download-3mf",
      "card-download-stl",
    ],
  },
  {
    title: "Accounts",
    names: [
      "account-created",
      "account-login",
      "account-logout",
      "account-deleted",
      "cookie-online",
      "cookie-replaced",
      "cookie-offline",
    ],
  },
];

const grouped = new Set(GROUPS.flatMap((group) => group.names));
const ALL_GROUPS = [
  ...GROUPS,
  {
    title: "Other",
    names: ACTION_NAMES.filter((name) => !grouped.has(name)),
  },
];

/**
 * What people did: making, downloads, sharing, cards, accounts – in the
 * range from the sidebar (or the hour or day chosen in the chart), each
 * against the same span before. Where it happened, and on which devices.
 */
export const AnalyticsActions = () => {
  const { data, range, focus } = useAnalytics();
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const actions = data.actions.filter(inRange);
  const previous =
    !focus && w.previous
      ? new Map(
          tally(
            data.actions
              .filter(inWindow(w.previous.from, w.previous.to))
              .map((row) => row.name)
          )
        )
      : null;
  const counts = new Map(tally(actions.map((row) => row.name)));

  // In each group's fixed order, only what happened (now or before).
  const groups = ALL_GROUPS.map((group) => ({
    title: group.title,
    entries: group.names
      .filter((name) => counts.has(name) || previous?.has(name))
      .map(
        (name): BarEntry => ({
          name: actionLabel(name),
          value: counts.get(name) ?? 0,
          ...(previous && { before: previous.get(name) ?? 0 }),
        })
      ),
  })).filter((group) => group.entries.length > 0);
  const all = groups.flatMap((group) => group.entries);
  // One scale for every group: bars in different groups compare too.
  const max = Math.max(
    1,
    ...all.map((entry) => Math.max(entry.value, entry.before ?? 0))
  );

  const pages = tally(actions.map((row) => pathLabel(row.path ?? "—"))).map(
    ([name, value]) => ({ name, value })
  );
  const devices = deviceSlices(actions.map((row) => row.device));

  return (
    <div className="ccm-viz">
      <Note>
        {focus ? focus.label : w.label} · {fmt(actions.length)} actions
        {previous && w.previous && (
          <span style={{ color: MUTED }}>
            {" "}
            – “before” is {w.previous.label}
          </span>
        )}
      </Note>
      {all.length === 0 ? (
        <Note>Nothing done in this time range.</Note>
      ) : (
        <>
          <ChartCard
            aside={
              previous && (
                <Key color="var(--viz-before)" line>
                  before
                </Key>
              )
            }
            table={barTable(all, "Action")}
            title="What people did"
          >
            <div
              style={{
                display: "grid",
                gap: "18px 32px",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              }}
            >
              {groups.map((group) => (
                <div key={group.title}>
                  <h5
                    style={{
                      color: TEXT,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      margin: "0 0 10px",
                      textTransform: "uppercase",
                    }}
                  >
                    {group.title}
                  </h5>
                  <BarList
                    entries={group.entries}
                    legend={false}
                    limit={20}
                    max={max}
                  />
                </div>
              ))}
            </div>
          </ChartCard>
          {actions.length > 0 && (
            <div className="ccm-viz__grid">
              <ChartCard table={barTable(pages, "Page")} title="On which page">
                <BarList entries={pages} />
              </ChartCard>
              <ChartCard
                table={{
                  head: ["Device", "Actions"],
                  rows: devices.map((slice) => [slice.name, slice.value]),
                }}
                title="On which device"
              >
                <Ring slices={devices} unit="actions" />
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
};
