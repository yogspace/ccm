"use client";

import { useEffect, useState } from "react";
import { EMPTY_DAYS, endOf, IDLE_DAYS } from "../../account/rules";
import { ChartCard, EndTimeline, type Fate, Meter, Sparkline } from "./charts";
import {
  countInSlots,
  DAY_MS,
  inWindow,
  rangeWindow,
  timeSlots,
  useAnalytics,
} from "./data";
import {
  compare,
  fmt,
  Loading,
  MUTED,
  Note,
  StatGrid,
  StatTile,
} from "./parts";

type AccountRow = {
  createdAt: string;
  lastSeenAt: string;
  cookies?: number | null;
  keep?: boolean | null;
};

type Totals = { accounts: AccountRow[]; links: number };

/** Accounts that go within this many days unless visited. */
const SOON_DAYS = 30;

/**
 * Only the fields the numbers need – never the jars (names of
 * creations) or anything else of an account – and of the short links only
 * how many there are.
 */
const load = async (): Promise<Totals | null> => {
  const select = ["createdAt", "lastSeenAt", "cookies", "keep"]
    .map((field) => `select[${field}]=true`)
    .join("&");
  const [accounts, links] = await Promise.all([
    fetch(`/api/accounts?depth=0&limit=0&pagination=false&${select}`, {
      credentials: "include",
    }),
    // Visitors' only – not the MakerWorld kits' (no account).
    fetch(
      "/api/short-links?depth=0&limit=1&select[code]=true&where[account][exists]=true",
      { credentials: "include" }
    ),
  ]);
  if (!(accounts.ok && links.ok)) return null;
  return {
    accounts: ((await accounts.json()).docs as AccountRow[]) ?? [],
    links: Number((await links.json()).totalDocs) || 0,
  };
};

/**
 * Visitors' accounts as totals – none of them listed, nothing that tells one
 * from another: new ones and visits in the range from the sidebar, how many
 * there are, what they keep online, and when each goes (a dot per account,
 * days left only). What people do with them
 * (logging in, putting cookies online …) is under Actions, anonymous like
 * every action.
 */
export const AnalyticsAccounts = () => {
  const { data, range } = useAnalytics();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    load().then(
      (loaded) => (loaded ? setTotals(loaded) : setFailed(true)),
      () => setFailed(true)
    );
  }, []);

  if (failed) return <Note>The accounts could not be loaded.</Note>;
  if (!(data && totals)) return <Loading />;

  const w = rangeWindow(range, data.lastDigestAt);
  const { accounts, links } = totals;
  const createdIn = (from: number, to: number) =>
    accounts.filter((row) => inWindow(from, to)(row)).length;
  const created = createdIn(w.from, w.open ? Number.POSITIVE_INFINITY : w.to);
  const before = w.previous && createdIn(w.previous.from, w.previous.to);
  // Only the last visit is kept: an account visited in the range counts once.
  const visited = accounts.filter(
    (row) => new Date(row.lastSeenAt).getTime() >= w.from
  ).length;
  // Each goes after its own time: sooner with nothing online.
  const soonBefore = Date.now() + SOON_DAYS * DAY_MS;
  const soon = accounts.filter(
    (row) => (endOf(row)?.getTime() ?? Number.POSITIVE_INFINITY) < soonBefore
  ).length;
  const kept = accounts.filter((row) => row.keep).length;
  const online = accounts.reduce((sum, row) => sum + (row.cookies ?? 0), 0);
  const keeping = accounts.filter((row) => (row.cookies ?? 0) > 0).length;
  // Kept ones never go, empty or not.
  const empty = accounts.filter(
    (row) => !row.keep && !((row.cookies ?? 0) > 0)
  ).length;

  // Every account as days left and cookies online – nothing else.
  const fates: Fate[] = accounts.map((row) => {
    const end = endOf(row);
    return {
      days:
        end === null
          ? null
          : Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS)),
      cookies: row.cookies ?? 0,
    };
  });
  const slots = timeSlots(w);

  return (
    <div className="ccm-viz">
      <Note>
        {w.label} – totals only, no account is listed.
        <span style={{ color: MUTED }}>
          {" "}
          Logins, cookies put online and the like are under Actions.
        </span>
      </Note>
      <StatGrid>
        <StatTile
          label="New accounts"
          value={created}
          {...(before !== null && w.previous
            ? compare(created, before, w.previous.label)
            : {})}
        >
          <Sparkline values={countInSlots(slots, accounts)} />
        </StatTile>
        <StatTile
          detail="last visit in this range"
          label="Accounts visited"
          value={visited}
        />
        <StatTile
          detail={`${fmt(soon)} go within ${SOON_DAYS} days · ${fmt(kept)} kept forever`}
          label="All accounts"
          value={accounts.length}
        />
        <StatTile
          detail={`in ${fmt(keeping)} accounts · ${fmt(empty)} empty, gone after ${EMPTY_DAYS} days unvisited`}
          label="Cookies online"
          value={online}
        >
          <Meter part={keeping} whole={accounts.length} />
        </StatTile>
        <StatTile
          detail="one per model put online"
          label="Short links"
          value={links}
        />
      </StatGrid>

      <div style={{ height: 12 }} />
      <ChartCard
        aside="unless visited – every visit starts it afresh"
        table={{
          head: ["Goes", "Accounts"],
          rows: [
            [
              "within 7 days",
              fates.filter((f) => f.days !== null && f.days < 7).length,
            ],
            [
              "within 30 days",
              fates.filter((f) => f.days !== null && f.days >= 7 && f.days < 30)
                .length,
            ],
            [
              "later",
              fates.filter((f) => f.days !== null && f.days >= 30).length,
            ],
            ["never (kept forever)", kept],
          ],
        }}
        title="When accounts go"
      >
        {accounts.length === 0 ? (
          <Note>No accounts yet.</Note>
        ) : (
          <EndTimeline fates={fates} horizon={IDLE_DAYS} marks={[7, 30, 90]} />
        )}
      </ChartCard>
    </div>
  );
};
