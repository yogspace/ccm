import { TRACKING } from "./config";
import { deviceName } from "./visit-matrix";
import { visitName } from "./visit-name";

/**
 * Visits as the admin (Visitors, Journeys, Locations) and the mail report
 * read them (stats/config.ts): with `visits` the page views of one visit in
 * their order; without, every page view stands alone.
 *
 * Shared and server-safe – no "use client": the cron route builds the mail
 * from it, and a module marked "use client" cannot be imported there (its
 * exports turn into client references on the server).
 */

/** The fields of a page view a visit is built from. */
export type JourneyRow = {
  id?: string | number;
  createdAt: string;
  path?: string | null;
  referrer?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  // The options in stats/config.ts – absent while switched off.
  country?: string | null;
  region?: string | null;
  city?: string | null;
  language?: string | null;
  view?: string | null;
  visit?: string | null;
  step?: number | null;
  seconds?: number | null;
  endedAt?: string | null;
};

/** One page of a visit. */
export type Step = {
  path: string;
  /** “About (DE)”. */
  label: string;
  at: number;
  /** When it was left – null while no time came. */
  end: number | null;
  /** Visible seconds – null while no time came. */
  seconds: number | null;
};

/** One visit – or, without `visits`, one page view. */
export type Journey = {
  key: string;
  /** A made-up name from the random visit id (“Quiet Otter”). */
  name: string;
  /** “mobile · iOS 18 · Safari 18”. */
  device: string;
  /** mobile, tablet or desktop. */
  deviceClass: string | null;
  /** “iOS 18”. */
  os: string | null;
  /** “Safari 18”. */
  browser: string | null;
  /** The browser's first language (“de”) – null without `TRACKING.origin`. */
  language: string | null;
  source: string;
  /** Country code (“DE”) – null without `TRACKING.origin` or a location. */
  country: string | null;
  region: string | null;
  city: string | null;
  /** “Munich (DE)” – null without a location. */
  place: string | null;
  start: number;
  /** When the last page was left – its start while no time came. */
  end: number;
  /** Visible seconds, all pages together. */
  seconds: number;
  /** Whether any page sent its time. */
  timed: boolean;
  steps: Step[];
  /** The steps' labels, in order. */
  pages: string[];
};

const at = (iso: string) => new Date(iso).getTime();

/** A page view without a visit id – older rows, or `visits` off. */
const SINGLE = "Single view";

/**
 * The views grouped into visits, latest first. `label` names a path
 * (stats/page-names.ts `pathLabel`, or the project's own).
 */
export const journeysOf = (
  views: JourneyRow[],
  label: (path: string) => string
): Journey[] => {
  const groups = new Map<string, JourneyRow[]>();
  for (const row of views) {
    const key =
      (TRACKING.visits && row.visit) ||
      row.view ||
      String(row.id ?? row.createdAt);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const journeys = [...groups.entries()]
    .map(([key, rows]): Journey => {
      rows.sort(
        (a, b) =>
          (a.step ?? 0) - (b.step ?? 0) || at(a.createdAt) - at(b.createdAt)
      );
      const [first] = rows;
      const steps = rows.map(
        (row): Step => ({
          path: row.path || "—",
          label: label(row.path || "—"),
          at: at(row.createdAt),
          end: row.endedAt ? at(row.endedAt) : null,
          seconds: typeof row.seconds === "number" ? row.seconds : null,
        })
      );
      return {
        key,
        name: TRACKING.visits && first.visit ? visitName(first.visit) : SINGLE,
        device: deviceName(first),
        deviceClass: first.device || null,
        os: first.os || null,
        browser: first.browser || null,
        language: first.language || null,
        source: first.referrer || "—",
        country: first.country || null,
        region: first.region || null,
        city: first.city || null,
        place: first.country
          ? first.city
            ? `${first.city} (${first.country})`
            : first.country
          : null,
        start: steps[0].at,
        end: Math.max(...steps.map((step) => step.end ?? step.at)),
        seconds: steps.reduce((sum, step) => sum + (step.seconds ?? 0), 0),
        timed: steps.some((step) => step.seconds !== null),
        steps,
        pages: steps.map((step) => step.label),
      };
    })
    .sort((a, b) => b.start - a.start);
  // Two visits with the same made-up name – the later one gets a number, so
  // the grid and the list never mix them up.
  const seen = new Map<string, number>();
  for (const journey of [...journeys].reverse()) {
    if (journey.name === SINGLE) continue;
    const count = (seen.get(journey.name) ?? 0) + 1;
    seen.set(journey.name, count);
    if (count > 1) journey.name = `${journey.name} ${count}`;
  }
  return journeys;
};

// ─── Paths as steps ──────────────────────────────────────────────────────────

/** Pages shown per step – the rest is “Other”. */
export const PER_STEP = 7;
export const OTHER_PAGE = "Other";

/**
 * The paths through the site as steps – what the admin's paths diagram and
 * the mail report draw: a column per step with its pages by how many visits
 * had them there (“Other” last), how many ended there, and the ways between
 * two steps with how often they were taken.
 */
export const pathSteps = (
  journeys: Journey[],
  steps: number,
  perStep = PER_STEP
) => {
  const kept = Array.from({ length: steps }, (_, col) => {
    const counts = new Map<string, number>();
    for (const j of journeys) {
      if (j.pages.length > col)
        counts.set(j.pages[col], (counts.get(j.pages[col]) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, perStep)
        .map(([name]) => name)
    );
  });
  /** A visit's page at a step – or “Other” beyond the strongest ones. */
  const nodeOf = (j: Journey, col: number) =>
    kept[col].has(j.pages[col]) ? j.pages[col] : OTHER_PAGE;

  const count = (values: string[]) => {
    const map = new Map<string, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const columns = Array.from({ length: steps }, (_, col) => {
    const here = journeys.filter((j) => j.pages.length > col);
    const counted = count(here.map((j) => nodeOf(j, col)));
    const ended = new Map(
      count(
        here
          .filter((j) => j.pages.length === col + 1)
          .map((j) => nodeOf(j, col))
      )
    );
    return {
      total: here.length,
      nodes: [
        ...counted.filter(([name]) => name !== OTHER_PAGE),
        ...counted.filter(([name]) => name === OTHER_PAGE),
      ].map(([name, n]) => ({ name, count: n, ended: ended.get(name) ?? 0 })),
    };
  }).filter((column) => column.total > 0);

  /** The ways between two steps, with how often – for any list of visits. */
  const linksOf = (list: Journey[]) =>
    columns.slice(0, -1).flatMap((_, col) =>
      count(
        list
          .filter((j) => j.pages.length > col + 1)
          .map((j) => `${nodeOf(j, col)}\u001f${nodeOf(j, col + 1)}`)
      ).map(([key, n]) => {
        const [from, to] = key.split("\u001f");
        return { col, from, to, count: n };
      })
    );

  return { nodeOf, columns, links: linksOf(journeys), linksOf };
};
