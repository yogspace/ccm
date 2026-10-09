"use client";

import { useEffect, useState } from "react";
import { EMPTY_DAYS, IDLE_DAYS } from "../../account/rules";
import { DAY_MS, inWindow, rangeWindow, useAnalytics } from "./data";
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
};

type Totals = { accounts: AccountRow[]; links: number };

/** Accounts that go within this many days unless visited. */
const SOON_DAYS = 30;

/**
 * Only the three fields the numbers need – never the jars (names of
 * creations) or anything else of an account – and of the short links only
 * how many there are.
 */
const load = async (): Promise<Totals | null> => {
  const select = ["createdAt", "lastSeenAt", "cookies"]
    .map((field) => `select[${field}]=true`)
    .join("&");
  const [accounts, links] = await Promise.all([
    fetch(`/api/accounts?depth=0&limit=0&pagination=false&${select}`, {
      credentials: "include",
    }),
    fetch("/api/short-links?depth=0&limit=1&select[code]=true", {
      credentials: "include",
    }),
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
 * there are, what they keep online, which go soon. What people do with them
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
  const soonBefore = Date.now() - (IDLE_DAYS - SOON_DAYS) * DAY_MS;
  const soon = accounts.filter(
    (row) => new Date(row.lastSeenAt).getTime() < soonBefore
  ).length;
  const online = accounts.reduce((sum, row) => sum + (row.cookies ?? 0), 0);
  const keeping = accounts.filter((row) => (row.cookies ?? 0) > 0).length;
  const empty = accounts.length - keeping;

  return (
    <>
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
        />
        <StatTile
          detail="last visit in this range"
          label="Accounts visited"
          value={visited}
        />
        <StatTile
          detail={`${fmt(soon)} go within ${SOON_DAYS} days unless visited`}
          label="All accounts"
          value={accounts.length}
        />
        <StatTile
          detail={`in ${fmt(keeping)} accounts · ${fmt(empty)} without (go after ${EMPTY_DAYS} days)`}
          label="Cookies online"
          value={online}
        />
        <StatTile
          detail="one per model put online"
          label="Short links"
          value={links}
        />
      </StatGrid>
    </>
  );
};
