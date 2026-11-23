import type { BasePayload } from "payload";
import { ACTION_NAMES, actionLabel, HIGHLIGHTS } from "@/stats/actions";
import { LOCALE, SITE_NAME, TIME_ZONE, TRACKING } from "@/stats/config";
import { atlasKey, countryName, languageName } from "@/stats/country-codes";
import { type JourneyRow, journeysOf } from "@/stats/journeys";
import { pageParts, pathLabel } from "@/stats/page-names";
import { tally } from "@/stats/tally";
import { deviceName } from "@/stats/visit-matrix";
import { countryFlag } from "@/stats/visit-name";
import {
  CHART_ID,
  PHONE_H,
  PHONE_W,
  ringPng,
  sparkPng,
  viewsChartPng,
} from "./chart-image";
import {
  compare,
  deviceClassName,
  deviceParts,
  pageRingParts,
  type RecentVisitor,
  renderReportHtml,
  reportBuckets,
  type Tile,
} from "./email";
import { MAP_W, mapPng } from "./journey-images";

/**
 * The report for a period – subject, text and HTML, without sending it. Apart
 * from the route handler (Next only allows handler exports there), so the
 * mail can also be looked at locally (scripts/preview-stats-digest.ts).
 */

const textList = (
  entries: [string, number][],
  total: number,
  limit = 10
): string => {
  if (!entries.length) return "  (keine)";
  return entries
    .slice(0, limit)
    .map(([label, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `  ${count.toString().padStart(5)}  ${pct.toString().padStart(3)} %  ${label}`;
    })
    .join("\n");
};

/** A page view as stored – the fields the options add absent while off. */
type ViewRow = JourneyRow;

/** Latest visitors listed in the mail – the rest is in the admin. */
const RECENT_VISITORS = 10;

export const buildDigest = async (
  payload: BasePayload,
  {
    sinceMs,
    now,
    interval,
  }: { sinceMs: number; now: number; interval: { label: string } }
): Promise<{
  subject: string;
  text: string;
  html: string;
  total: number;
  /** The pictures in the mail (sendMail's `inline`). */
  inline: { filename: string; contentId: string; content: Buffer }[];
}> => {
  const since = new Date(sinceMs).toISOString();
  const period = { createdAt: { greater_than_equal: since } };
  // The same span before – for the comparison (within the 90 days kept).
  const before = {
    and: [
      {
        createdAt: {
          greater_than_equal: new Date(sinceMs - (now - sinceMs)).toISOString(),
        },
      },
      { createdAt: { less_than: since } },
    ],
  };

  const [{ docs: views }, { docs: actions }, viewsBefore, actionsBefore] =
    await Promise.all([
      payload.find({
        collection: "page-views",
        where: period,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: "actions",
        where: period,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
      // When they were – for the period before in the chart; with `visits`
      // whole rows, for the visitors before.
      payload.find({
        collection: "page-views",
        where: before,
        depth: 0,
        pagination: false,
        ...(TRACKING.visits ? {} : { select: { createdAt: true } }),
        overrideAccess: true,
      }),
      payload.find({
        collection: "actions",
        where: before,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
    ]);
  const rows = views as unknown as ViewRow[];
  const rowsBefore = viewsBefore.docs as unknown as {
    createdAt?: string | null;
    visit?: string | null;
  }[];

  const total = rows.length;
  const byPage = tally(rows.map((r) => r.path)).map(
    ([path, count]): [string, number] => [pathLabel(path), count]
  );
  const sourceRows = rows.filter((r) => r.referrer !== "internal");
  const bySource = tally(sourceRows.map((r) => r.referrer));
  const byDevice = tally(rows.map(deviceName));

  const counts = new Map(tally(actions.map((row) => row.name)));
  const countsBefore = new Map(
    tally(actionsBefore.docs.map((row) => row.name))
  );
  const actionList = ACTION_NAMES.filter(
    (name) => counts.has(name) || countsBefore.has(name)
  ).map((name) => ({
    name,
    label: actionLabel(name, "de"),
    count: counts.get(name) ?? 0,
    before: countsBefore.get(name) ?? 0,
  }));

  const timesOf = (list: { createdAt?: string | null }[]) =>
    list.flatMap((row) =>
      row.createdAt ? [new Date(row.createdAt).getTime()] : []
    );
  // The same hours or days of the period before, laid over this one.
  const span = now - sinceMs;
  const beforeChart = reportBuckets(
    timesOf(rowsBefore).map((t) => t + span),
    sinceMs,
    now
  );
  const sparkOf = (list: { createdAt?: string | null }[]) =>
    reportBuckets(timesOf(list), sinceMs, now).buckets.map((b) => b.count);

  // The tiles after the page views: downloads and cards (stats/actions.ts),
  // as in the admin's Overview.
  const highlights = HIGHLIGHTS.map(({ label, names }) => {
    const counted = new Set<string>(names);
    const sum = (map: Map<string, number>) =>
      [...map].reduce((n, [name, c]) => n + (counted.has(name) ? c : 0), 0);
    return {
      label: label.de,
      count: sum(counts),
      before: sum(countsBefore),
      rows: actions.filter((row) => counted.has(row.name)),
    };
  });

  // ── Visitors (`TRACKING.visits`) ──────────────────────────────────────────
  // The views of one visit linked by its random id, each visit under a
  // made-up name – as in the admin. Views without an id (from before the
  // option was on) stay in the counts, but have no visitor to stand under.
  const tracked = TRACKING.visits ? rows.filter((row) => row.visit) : [];
  const journeys = journeysOf(tracked, pathLabel);
  const visitorCount = journeys.length;
  const singlePage = journeys.filter((j) => j.pages.length === 1).length;
  // Compared only once the period before had any – before the option was
  // on there were none, and “vorher 0” would say nothing.
  const visitorsBefore = TRACKING.visits
    ? new Set(rowsBefore.map((row) => row.visit).filter(Boolean)).size
    : 0;
  const visitorsDelta =
    visitorsBefore > 0 ? compare(visitorCount, visitorsBefore) : null;

  // The latest visitors with their path – who came, from where, which way.
  const known = (value: string | null) =>
    value && value !== "unknown" ? value : null;
  const recentVisitors: RecentVisitor[] = journeys
    .slice(0, RECENT_VISITORS)
    .map((j) => ({
      when: new Date(j.start)
        .toLocaleString(LOCALE, {
          timeZone: TIME_ZONE,
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
        // Without commas – in a narrow column they broke right there.
        .replace(/,/g, ""),
      name: j.name,
      place: j.country
        ? `${countryFlag(j.country)} ${countryName(j.country, LOCALE)}`.trim()
        : "",
      device: [
        j.deviceClass ? deviceClassName(j.deviceClass) : null,
        // “unknown”: a client without a readable user agent – says nothing.
        known(j.os),
        known(j.browser),
        !j.source || j.source === "—" || j.source === "internal"
          ? null
          : j.source === "direct"
            ? "direkt"
            : `von ${j.source}`,
      ]
        .filter(Boolean)
        .join(" · "),
      path:
        j.pages.slice(0, 6).join(" → ") + (j.pages.length > 6 ? " → …" : ""),
    }));

  // ── Where they are (`TRACKING.origin`) ────────────────────────────────────
  // Only the country – the country database knows no region or city.
  const located = TRACKING.origin ? rows.filter((row) => row.country) : [];
  const byCountry = tally(located.map((row) => row.country));
  const countryShades = new Map<string, number>();
  for (const [code, count] of byCountry) {
    const key = atlasKey(code);
    if (key) countryShades.set(key, count);
  }
  // Names in German (LOCALE): “Deutschland”.
  const countries: [string, number][] = byCountry.map(([code, count]) => [
    `${countryFlag(code)} ${countryName(code, LOCALE)}`.trim(),
    count,
  ]);
  const languages: [string, number][] = TRACKING.origin
    ? tally(rows.map((row) => row.language).filter(Boolean)).map(
        ([code, count]) => [languageName(code, LOCALE), count]
      )
    : [];

  const tz = { timeZone: TIME_ZONE } as const;
  const periodLabel = `${new Date(sinceMs).toLocaleDateString(LOCALE, tz)} – ${new Date(now).toLocaleDateString(LOCALE, tz)}`;
  const chart = {
    ...reportBuckets(timesOf(rows), sinceMs, now),
    before: beforeChart.buckets.map((b) => b.count),
  };

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "https://ccm.mxwr.de";
  const adminUrl = `${serverUrl}/admin/globals/analytics`;
  const title = `${interval.label}report`;
  const viewsDelta = compare(total, rowsBefore.length);
  const decimal = (n: number) =>
    n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
  const perVisitor = visitorCount ? tracked.length / visitorCount : 0;
  const leftAfterOne = visitorCount
    ? `${Math.round((singlePage / visitorCount) * 100)} % nach einer Seite weg`
    : "";

  const text = [
    `${SITE_NAME} · ${title} — ${periodLabel}`,
    "",
    ...(TRACKING.visits
      ? [
          `Besucher: ${visitorCount}${visitorsDelta ? ` (${visitorsDelta.text})` : ""}`,
        ]
      : []),
    `Seitenaufrufe: ${total}${viewsDelta ? ` (${viewsDelta.text})` : ""}`,
    ...highlights.map((h) => {
      const delta = compare(h.count, h.before);
      return `${h.label}: ${h.count}${delta ? ` (${delta.text})` : ""}`;
    }),
    ...(TRACKING.visits && visitorCount
      ? [`Seiten pro Besucher: ${decimal(perVisitor)} (${leftAfterOne})`]
      : []),
    "",
    "Seiten:",
    textList(byPage, total),
    "",
    "Geräte:",
    textList(byDevice, total),
    "",
    "Quellen (ohne interne Navigation):",
    textList(bySource, sourceRows.length),
    ...(countries.length
      ? ["", "Länder:", textList(countries, located.length)]
      : []),
    ...(languages.length
      ? [
          "",
          "Sprachen (die erste des Browsers):",
          textList(
            languages,
            languages.reduce((sum, [, n]) => sum + n, 0)
          ),
        ]
      : []),
    ...(recentVisitors.length
      ? [
          "",
          "Letzte Besucher (Namen erfunden):",
          recentVisitors
            .map(
              (v) =>
                `  ${v.when}  ${v.name}${v.place ? ` · ${v.place}` : ""}${v.device ? ` · ${v.device}` : ""}\n    ${v.path}`
            )
            .join("\n"),
          ...(visitorCount > recentVisitors.length
            ? [
                `  + ${visitorCount - recentVisitors.length} weitere – alle im Admin unter Analytics → Visitors`,
              ]
            : []),
        ]
      : []),
    "",
    "Aktionen:",
    actionList.length
      ? actionList
          .map(
            (a) =>
              `  ${a.count.toString().padStart(5)}  ${a.label} (vorher ${a.before})`
          )
          .join("\n")
      : "  (keine)",
    "",
    `Analytics im Admin öffnen: ${adminUrl}`,
  ].join("\n");

  const [topPage] = byPage;
  const [topSource] = bySource;
  const beforeShown = chart.before.some((n) => n > 0)
    ? chart.before
    : undefined;
  // Every picture on its own: one failing leaves the others – the mail then
  // draws columns instead, or leaves the picture out.
  const picture = <T>(make: () => Promise<T>) =>
    make().catch((error) => {
      console.error("[stats-digest] picture failed:", error);
      return null;
    });
  const none = async () => null;
  const byClass = tally(rows.map((row) => row.device));
  const viewsSparkValues = chart.buckets.map((b) => b.count);
  // A visitor's course: the first page of each visit.
  const visitorsSparkValues = sparkOf(tracked.filter((row) => row.step === 1));
  // The pages as a ring – a part per page and language.
  const pages = pageParts(rows.map((row) => row.path));
  const [visitorsSpark, map, pagesRing] = await Promise.all([
    picture(TRACKING.visits ? () => sparkPng(visitorsSparkValues) : none),
    picture(TRACKING.origin ? () => mapPng(countryShades) : none),
    picture(() => ringPng(pageRingParts(pages), total, "Aufrufe")),
  ]);
  const [png, phonePng, ring, viewsSpark, ...highlightSparks] =
    await Promise.all([
      picture(() => viewsChartPng(chart.buckets, beforeShown)),
      picture(() =>
        viewsChartPng(chart.buckets, beforeShown, {
          width: PHONE_W,
          height: PHONE_H,
        })
      ),
      picture(() => ringPng(deviceParts(byClass), total, "Aufrufe")),
      picture(() => sparkPng(viewsSparkValues)),
      ...highlights.map((h) => picture(() => sparkPng(sparkOf(h.rows)))),
    ]);
  // Each an embedded file of its own, referred to as `cid:<contentId>` –
  // never inline `data:` (Gmail clips mails above 102 KB).
  const files: [string, string, Buffer | null][] = [
    ["seitenaufrufe.png", CHART_ID, png],
    ["seitenaufrufe-handy.png", `${CHART_ID}-phone`, phonePng],
    ["geraete.png", "devices-ring", ring],
    ["verlauf-aufrufe.png", "spark-views", viewsSpark],
    ["verlauf-besucher.png", "spark-visitors", visitorsSpark],
    ["laender.png", "countries-map", map],
    ["seiten.png", "pages-ring", pagesRing],
    ...highlights.map((_, i): [string, string, Buffer | null] => [
      `verlauf-${i}.png`,
      `spark-${i}`,
      highlightSparks[i],
    ]),
  ];
  const inline = files.flatMap(([filename, contentId, content]) =>
    content ? [{ filename, contentId, content }] : []
  );

  // Row 1: how many – with their course. Row 2: what and how. As in the
  // admin's Overview, each group in full rows of three.
  const headline: Tile[] = [
    ...(TRACKING.visits
      ? [
          {
            label: "Besucher",
            value: visitorCount,
            delta: visitorsDelta,
            spark: visitorsSparkValues,
            sparkImage: visitorsSpark ? "cid:spark-visitors" : undefined,
          },
        ]
      : []),
    {
      label: "Seitenaufrufe",
      value: total,
      delta: viewsDelta,
      spark: viewsSparkValues,
      sparkImage: viewsSpark ? "cid:spark-views" : undefined,
    },
    ...highlights.map(
      (h, i): Tile => ({
        label: h.label,
        value: h.count,
        delta: compare(h.count, h.before),
        spark: sparkOf(h.rows),
        sparkImage: highlightSparks[i] ? `cid:spark-${i}` : undefined,
      })
    ),
  ];
  const facts: Tile[] = [
    {
      label: "Meistbesuchte Seite",
      value: topPage?.[1] ?? 0,
      detail: topPage
        ? `${topPage[0]} · ${Math.round((topPage[1] / total) * 100)} %`
        : "—",
      share: topPage ? topPage[1] / total : 0,
    },
    {
      label: "Top-Quelle",
      value: topSource?.[1] ?? 0,
      detail: topSource
        ? `${topSource[0]} · ${Math.round((topSource[1] / sourceRows.length) * 100)} %`
        : "—",
      share: topSource ? topSource[1] / sourceRows.length : 0,
    },
    ...(TRACKING.visits
      ? [
          {
            label: "Seiten pro Besucher",
            value: 0,
            display: visitorCount ? decimal(perVisitor) : "—",
            detail: leftAfterOne || "—",
            ...(visitorCount ? { share: 1 - singlePage / visitorCount } : {}),
          },
        ]
      : []),
  ];

  const html = renderReportHtml({
    title,
    period: periodLabel,
    adminUrl,
    tiles: [headline, facts],
    chart: {
      ...chart,
      image: png ? `cid:${CHART_ID}` : undefined,
      phoneImage: png && phonePng ? `cid:${CHART_ID}-phone` : undefined,
    },
    devices: byClass,
    devicesImage: ring ? "cid:devices-ring" : undefined,
    pages,
    pagesImage: pagesRing ? "cid:pages-ring" : undefined,
    sources: bySource,
    actions: actionList,
    recentVisitors,
    moreVisitors: Math.max(0, visitorCount - recentVisitors.length),
    origin: located.length
      ? {
          countries,
          languages,
          image: map ? "cid:countries-map" : undefined,
          imageWidth: MAP_W,
          missing: total - located.length,
        }
      : null,
  });

  const [downloads] = highlights;
  return {
    subject: TRACKING.visits
      ? `${SITE_NAME} · ${interval.label}-Statistik: ${visitorCount} Besucher · ${total} Aufrufe`
      : `${SITE_NAME} · ${interval.label}-Statistik: ${total} Aufrufe, ${downloads.count} Downloads`,
    text,
    html,
    total,
    inline,
  };
};
