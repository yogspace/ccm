"use client";

import { ACTION_NAMES, actionLabel } from "../../stats/actions";
import { pathLabel } from "../../stats/page-names";
import { tally } from "../../stats/tally";
import { inWindow, rangeWindow, useAnalytics } from "./data";
import {
  type Entry,
  fmt,
  Loading,
  MUTED,
  Note,
  RankList,
  Subsection,
} from "./parts";

/**
 * What people did: downloads, sharing, cards, imports – in the range from
 * the sidebar (or the bar chosen in the chart), each with the same span
 * before for comparison.
 */
export const AnalyticsActions = () => {
  const { data, range, focus } = useAnalytics();
  if (!data) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const inRange = focus
    ? inWindow(focus.from, focus.to)
    : inWindow(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const actions = data.actions.filter(inRange);
  const before =
    !focus && w.previous
      ? tally(
          data.actions
            .filter(inWindow(w.previous.from, w.previous.to))
            .map((row) => row.name)
        )
      : null;
  const previous = new Map(before ?? []);
  const counts = new Map(tally(actions.map((row) => row.name)));

  // In the fixed order of the list (downloads first), only what happened.
  const entries: Entry[] = ACTION_NAMES.filter(
    (name) => counts.has(name) || previous.has(name)
  ).map((name) => [
    actionLabel(name),
    counts.get(name) ?? 0,
    before ? `before: ${fmt(previous.get(name) ?? 0)}` : undefined,
  ]);

  const devices = tally(actions.map((row) => row.device));
  const pages = tally(actions.map((row) => pathLabel(row.path ?? "—")));

  return (
    <>
      <Note>
        {focus ? focus.label : w.label} · {fmt(actions.length)} actions
        {before && w.previous && (
          <span style={{ color: MUTED }}>
            {" "}
            – “before” is {w.previous.label}
          </span>
        )}
      </Note>
      {entries.length === 0 ? (
        <Note>Nothing done in this time range.</Note>
      ) : (
        <>
          <Subsection title="Actions">
            <RankList entries={entries} />
          </Subsection>
          <Subsection title="On which page">
            <RankList entries={pages} />
          </Subsection>
          <Subsection title="On which device">
            <RankList entries={devices} />
          </Subsection>
        </>
      )}
    </>
  );
};
