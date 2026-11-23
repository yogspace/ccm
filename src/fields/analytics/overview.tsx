"use client";

import { Button } from "@payloadcms/ui";
import type { ComponentProps } from "react";
import { HIGHLIGHTS } from "../../stats/actions";
import { LOCALE, TRACKING } from "../../stats/config";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import {
  AreaChart,
  ChartCard,
  Key,
  Meter,
  Sparkline,
  type TimePoint,
  timeTable,
} from "./charts";
import {
  countInSlots,
  deleteRows,
  inWindow,
  rangeWindow,
  setFocus,
  timeSlots,
  useAnalytics,
} from "./data";
import {
  ButtonRow,
  compare,
  duration,
  fmt,
  Loading,
  MUTED,
  median,
  Note,
  ResetChip,
  StatGrid,
  StatTile,
} from "./parts";

type Tile = ComponentProps<typeof StatTile> & { id: string };

/**
 * A group of tiles in full rows of three: the last one spans what is left of
 * its row – no gap at the end of a row.
 */
const fullRows = (tiles: Tile[]) => {
  const rest = tiles.length % 3;
  return tiles.map(({ id, ...tile }, i) => (
    <StatTile
      key={id}
      {...tile}
      {...(rest && i === tiles.length - 1 ? { span: 4 - rest } : {})}
    />
  ));
};

const decimal = (n: number) =>
  n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/**
 * The range from the sidebar at a glance: key figures with their course,
 * the page views over time against the period before, deleting. ONE range
 * for the whole global – figures, chart, Visitors and Actions count the
 * same rows, so the numbers agree with each other.
 *
 * The visitor count (`TRACKING.visits`) and the times (`TRACKING.timing`)
 * live only here – the other sections don't repeat them.
 */
export const AnalyticsOverview = () => {
  const { data, busy, failed, range, focus } = useAnalytics();
  if (failed && !data) return <Note>Could not load the analytics.</Note>;
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  // An open range runs until now – without an upper bound, so a view from
  // just now belongs to it.
  const until = w.open ? Number.POSITIVE_INFINITY : w.to;
  const views = data.views.filter(inWindow(w.from, until));
  const actions = data.actions.filter(inWindow(w.from, until));
  const before = w.previous;
  const earlier = <T extends { createdAt: string }>(rows: T[]) =>
    before ? rows.filter(inWindow(before.from, before.to)) : null;
  const viewsBefore = earlier(data.views);
  const actionsBefore = earlier(data.actions);

  // The actions that matter most (stats/actions.ts), each with its course.
  const highlights = HIGHLIGHTS.map(({ label, names }) => {
    const counted = new Set<string>(names);
    const of = (row: { name: string }) => counted.has(row.name);
    return { label: label.en, of, rows: actions.filter(of) };
  });
  const [topPage] = tally(views.map((row) => row.path));
  // Without internal navigation – it says nothing about where people came
  // from.
  const external = views.filter((row) => row.referrer !== "internal");
  const [topSource] = tally(external.map((row) => row.referrer));

  // Every hour or day of the range – and the same moment of the period
  // before, for the grey line.
  const slots = timeSlots(w);
  const counts = countInSlots(slots, views);
  const shift = before ? w.from - before.from : 0;
  const beforeCounts = before
    ? countInSlots(
        slots.map((slot) => ({ from: slot.from - shift, to: slot.to - shift })),
        data.views
      )
    : null;
  const points: TimePoint[] = slots.map((slot, i) => ({
    ...slot,
    count: counts[i],
    ...(beforeCounts && { before: beforeCounts[i] }),
  }));

  const versus = (now: number, then: number | undefined) =>
    then === undefined || !before ? {} : compare(now, then, before.label);

  // Visitors (`TRACKING.visits`): one per visit id. The period before only
  // compares once it has any – before the option was on there were none,
  // and “up from 0” would say nothing.
  const perVisit = new Map<string, number>();
  for (const row of views) {
    if (row.visit) perVisit.set(row.visit, (perVisit.get(row.visit) ?? 0) + 1);
  }
  const visitors = perVisit.size;
  const visitorsBefore = new Set(
    (viewsBefore ?? []).map((row) => row.visit).filter(Boolean)
  ).size;
  const linked = [...perVisit.values()].reduce((sum, n) => sum + n, 0);
  const singlePage = [...perVisit.values()].filter((n) => n === 1).length;

  // Times (`TRACKING.timing`): visible seconds per page – a hidden tab does
  // not count; with `visits` also per visit, all its pages together.
  const timed = views.filter((row) => typeof row.seconds === "number");
  const secondsOf = (row: (typeof views)[number]) => row.seconds ?? 0;
  const visitSeconds = new Map<string, number>();
  for (const row of timed) {
    if (row.visit) {
      visitSeconds.set(
        row.visit,
        (visitSeconds.get(row.visit) ?? 0) + secondsOf(row)
      );
    }
  }

  // Row 1: how many – with their course. Row 2: what and how.
  const headline: Tile[] = [
    ...(TRACKING.visits
      ? [
          {
            id: "visitors",
            label: "Visitors",
            value: visitors,
            ...(visitorsBefore > 0 ? versus(visitors, visitorsBefore) : {}),
            children: (
              <Sparkline
                values={countInSlots(
                  slots,
                  views.filter((row) => row.visit && row.step === 1)
                )}
              />
            ),
          },
        ]
      : []),
    {
      id: "views",
      label: "Page views",
      value: views.length,
      ...versus(views.length, viewsBefore?.length),
      children: <Sparkline values={counts} />,
    },
    ...highlights.map(({ label, of, rows }) => ({
      id: `action-${label}`,
      label,
      value: rows.length,
      ...versus(rows.length, actionsBefore?.filter(of).length),
      children: <Sparkline values={countInSlots(slots, rows)} />,
    })),
  ];
  const facts: Tile[] = [
    {
      id: "top-page",
      detail: topPage
        ? `${pathLabel(topPage[0])} · ${Math.round((topPage[1] / views.length) * 100)} % of views`
        : "—",
      detailTitle: topPage?.[0],
      label: "Most viewed page",
      value: topPage ? topPage[1] : 0,
      children: <Meter part={topPage?.[1] ?? 0} whole={views.length} />,
    },
    {
      id: "top-source",
      detail: topSource
        ? `${topSource[0]} · ${Math.round((topSource[1] / external.length) * 100)} % of arrivals`
        : "—",
      label: "Top source",
      value: topSource ? topSource[1] : 0,
      children: <Meter part={topSource?.[1] ?? 0} whole={external.length} />,
    },
    ...(TRACKING.visits
      ? [
          {
            id: "pages-per-visitor",
            detail: visitors
              ? `${Math.round((singlePage / visitors) * 100)} % left after one page`
              : "—",
            format: decimal,
            label: "Pages per visitor",
            value: visitors ? linked / visitors : 0,
            children: <Meter part={visitors - singlePage} whole={visitors} />,
          },
        ]
      : []),
    ...(TRACKING.timing && TRACKING.visits
      ? [
          {
            id: "visit-length",
            detail: "first page to last, median",
            format: duration,
            label: "Visit length",
            value: median([...visitSeconds.values()]),
          },
        ]
      : []),
    ...(TRACKING.timing
      ? [
          {
            id: "time-on-page",
            detail: "per page, median",
            format: duration,
            label: "Time on page",
            value: median(timed.map(secondsOf)),
          },
          {
            id: "time-on-site",
            detail: "all visitors together",
            format: duration,
            label: "Time on the site",
            value: timed.reduce((sum, row) => sum + secondsOf(row), 0),
          },
        ]
      : []),
  ];

  const confirmRange = () => {
    if (
      window.confirm(
        `Delete the ${fmt(views.length)} page views and ${fmt(actions.length)} actions of "${w.label}"? This cannot be undone.`
      )
    ) {
      deleteRows(w);
    }
  };
  const confirmAll = () => {
    if (
      window.confirm(
        `Delete ALL ${fmt(data.views.length)} page views and ${fmt(data.actions.length)} actions? This cannot be undone.`
      )
    ) {
      deleteRows("all");
    }
  };

  return (
    <div className="stats-viz">
      <Note>
        {w.label}
        {before && (
          <span style={{ color: MUTED }}> · compared with {before.label}</span>
        )}
      </Note>
      <StatGrid>
        {fullRows(headline)}
        {fullRows(facts)}
      </StatGrid>

      <div style={{ height: 12 }} />
      <ChartCard
        aside={
          <>
            <Key color="var(--viz-1)" line>
              {w.label}
            </Key>
            {before && (
              <Key color="var(--viz-before)" line>
                {before.label}
              </Key>
            )}
          </>
        }
        table={timeTable(points, "Page views")}
        title={
          w.grain === "hour" ? "Page views per hour" : "Page views per day"
        }
      >
        {views.length === 0 && !viewsBefore?.length ? (
          <Note>No views in this range.</Note>
        ) : (
          <AreaChart
            // A click chooses the hour or day – once more lifts it.
            onSelect={(point) =>
              focus?.from === point.from
                ? setFocus(null)
                : setFocus({
                    from: point.from,
                    to: point.to,
                    label: point.title,
                  })
            }
            points={points}
            selectedFrom={focus?.from ?? null}
            unit="views"
          />
        )}
        <div
          style={{
            alignItems: "center",
            color: MUTED,
            display: "flex",
            flexWrap: "wrap",
            fontSize: 12,
            gap: 8,
            marginTop: 6,
          }}
        >
          {focus ? (
            <>
              Visitors & Actions show only {focus.label}
              <ResetChip
                onReset={() => setFocus(null)}
                title="Show the whole range again"
              />
            </>
          ) : (
            "Click the chart to narrow Visitors and Actions down to that hour or day."
          )}
        </div>
      </ChartCard>

      <Note>Deleting removes stored page views and actions for good.</Note>
      <ButtonRow>
        {range !== "all" && (
          <Button
            buttonStyle="subtle"
            disabled={busy || views.length + actions.length === 0}
            margin={false}
            onClick={confirmRange}
            size="medium"
            type="button"
          >
            {`Delete this range (${fmt(views.length + actions.length)})`}
          </Button>
        )}
        <Button
          buttonStyle="subtle"
          disabled={busy || data.views.length + data.actions.length === 0}
          margin={false}
          onClick={confirmAll}
          size="medium"
          type="button"
        >
          Delete everything
        </Button>
      </ButtonRow>
    </div>
  );
};
