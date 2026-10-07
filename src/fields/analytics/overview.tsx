"use client";

import { Button } from "@payloadcms/ui";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import {
  DAY_MS,
  deleteRows,
  inWindow,
  rangeWindow,
  setFocus,
  useAnalytics,
  type ViewRow,
  type Window,
} from "./data";
import {
  BarChart,
  type Bucket,
  ButtonRow,
  compare,
  fmt,
  Loading,
  MUTED,
  Note,
  ResetChip,
  StatGrid,
  StatTile,
  Subsection,
} from "./parts";

const HOUR_MS = 60 * 60 * 1000;

const two = (n: number) => String(n).padStart(2, "0");
const weekdayDay = (d: Date) =>
  d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

/**
 * Columns over the range – EVERY hour or day, even without views. Without
 * the empty ones two columns a week apart would stand side by side, and the
 * course would look denser than it was. Up to three days in hours, beyond in
 * days; the axis labels only quiet places.
 */
const timeBuckets = (rows: ViewRow[], w: Window): Bucket[] => {
  const floor = (t: number) => {
    const d = new Date(t);
    if (w.grain === "hour") d.setMinutes(0, 0, 0);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const counts = new Map<number, number>();
  for (const row of rows) {
    const key = floor(new Date(row.createdAt).getTime());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const multiDay = w.to - w.from > DAY_MS + HOUR_MS;
  const out: Bucket[] = [];
  // Counted on by the date, not fixed milliseconds: at the clock change a
  // day has 23 or 25 hours.
  const cursor = new Date(floor(w.from));
  while (cursor.getTime() < w.to) {
    const t = cursor.getTime();
    const d = new Date(t);
    if (w.grain === "hour") {
      const h = d.getHours();
      cursor.setHours(cursor.getHours() + 1);
      out.push({
        count: counts.get(t) ?? 0,
        label: multiDay && h === 0 ? weekdayDay(d) : two(h),
        title: `${weekdayDay(d)}, ${two(h)}:00–${two((h + 1) % 24)}:00`,
        tick: multiDay ? h % 12 === 0 : h % 3 === 0,
        from: t,
        to: cursor.getTime(),
      });
    } else {
      cursor.setDate(cursor.getDate() + 1);
      out.push({
        count: counts.get(t) ?? 0,
        label: d
          .toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
          .replace(/\.$/, ""),
        title: weekdayDay(d),
        from: t,
        to: cursor.getTime(),
      });
    }
  }
  // The last bar of an open range is not finished yet.
  const last = out.at(-1);
  if (w.open && last) last.partial = true;
  if (w.grain === "day" && out.length > 16) {
    out.forEach((b, i) => {
      b.tick = i % 7 === 0 || i === out.length - 1;
    });
  }
  return out;
};

const DOWNLOADS = new Set([
  "download-3mf",
  "download-stl",
  "card-download-3mf",
  "card-download-stl",
]);

/**
 * The range from the sidebar at a glance: key figures, the course over time,
 * deleting. ONE range for the whole global – tiles, columns, Visitors and
 * Actions count the same rows, so the numbers agree with each other. The
 * tiles compare with the same span before.
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
  const count = <T extends { createdAt: string }>(rows: T[]) =>
    before ? rows.filter(inWindow(before.from, before.to)) : null;
  const viewsBefore = count(data.views);
  const actionsBefore = count(data.actions);

  const downloads = actions.filter((row) => DOWNLOADS.has(row.name)).length;
  const downloadsBefore = actionsBefore?.filter((row) =>
    DOWNLOADS.has(row.name)
  ).length;
  const cards = actions.filter((row) => row.name === "card-created").length;
  const cardsBefore = actionsBefore?.filter(
    (row) => row.name === "card-created"
  ).length;
  const [topPage] = tally(views.map((r) => r.path));
  // Without internal navigation – it says nothing about where people came
  // from.
  const [topSource] = tally(
    views.filter((r) => r.referrer !== "internal").map((r) => r.referrer)
  );

  const versus = (now: number, then: number | undefined) =>
    then === undefined || !before ? {} : compare(now, then, before.label);

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
    <>
      <Note>{w.label}</Note>
      <StatGrid>
        <StatTile
          label="Page views"
          value={views.length}
          {...versus(views.length, viewsBefore?.length)}
        />
        <StatTile
          label="Downloads (3MF + STL)"
          value={downloads}
          {...versus(downloads, downloadsBefore)}
        />
        <StatTile
          label="Cards created"
          value={cards}
          {...versus(cards, cardsBefore)}
        />
        <StatTile
          detail={topPage ? pathLabel(topPage[0]) : "—"}
          detailTitle={topPage?.[0]}
          label="Most viewed page"
          value={topPage ? topPage[1] : 0}
        />
        <StatTile
          detail={topSource ? topSource[0] : "—"}
          label="Top source"
          value={topSource ? topSource[1] : 0}
        />
      </StatGrid>

      <div style={{ height: 20 }} />
      <Subsection
        aside={
          focus ? (
            <span
              style={{
                alignItems: "center",
                color: MUTED,
                display: "inline-flex",
                fontSize: 12,
                gap: 8,
              }}
            >
              Visitors & Actions: {focus.label}
              <ResetChip
                onReset={() => setFocus(null)}
                title="Show the whole range again"
              />
            </span>
          ) : (
            <span style={{ color: MUTED, fontSize: 12 }}>
              Click a bar to narrow Visitors and Actions down
            </span>
          )
        }
        title={
          w.grain === "hour" ? "Page views per hour" : "Page views per day"
        }
      >
        <BarChart
          buckets={timeBuckets(views, w)}
          // A click chooses the bar – once more lifts it.
          onSelect={(b) =>
            b.from === undefined || b.to === undefined || focus?.from === b.from
              ? setFocus(null)
              : setFocus({ from: b.from, to: b.to, label: b.title ?? b.label })
          }
          selectedFrom={focus?.from ?? null}
        />
      </Subsection>

      <Note>Deleting removes stored page views and actions for good.</Note>
      <ButtonRow>
        {range !== "90d" && (
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
    </>
  );
};
