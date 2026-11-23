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
