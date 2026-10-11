import type { BasePayload } from "payload";
import { ACTION_NAMES, actionLabel } from "@/stats/actions";
import { pathLabel } from "@/stats/page-names";
import { tally } from "@/stats/tally";
import { deviceName, type Visit } from "@/stats/visit-matrix";
import { CHART_ID, ringPng, sparkPng, viewsChartPng } from "./chart-image";
import { compare, deviceParts, renderReportHtml, reportBuckets } from "./email";

/**
 * The report for a period – subject, text and HTML, without sending it. Apart
 * from the route handler (Next only allows handler exports there), so the
 * mail can also be looked at locally.
 */

const DOWNLOADS = new Set([
  "download-3mf",
  "download-stl",
  "card-download-3mf",
  "card-download-stl",
]);

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

type ViewRow = {
  path?: string | null;
  referrer?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  createdAt?: string | null;
};

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
  /** The chart as a picture in the mail (sendMail's `inline`). */
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
      // Only when they were – for the period before in the chart.
      payload.find({
        collection: "page-views",
        where: before,
        depth: 0,
        pagination: false,
        select: { createdAt: true },
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
  const rows = views as ViewRow[];

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
  const sum = (map: Map<string, number>, pick: (name: string) => boolean) =>
    [...map].reduce((n, [name, count]) => n + (pick(name) ? count : 0), 0);
  const downloads = sum(counts, (name) => DOWNLOADS.has(name));
  const downloadsBefore = sum(countsBefore, (name) => DOWNLOADS.has(name));
  const cards = counts.get("card-created") ?? 0;
  const cardsBefore = countsBefore.get("card-created") ?? 0;

  const timesOf = (list: { createdAt?: string | null }[]) =>
    list.flatMap((row) =>
      row.createdAt ? [new Date(row.createdAt).getTime()] : []
    );
  // The same hours or days of the period before, laid over this one.
  const span = now - sinceMs;
  const beforeChart = reportBuckets(
    timesOf(viewsBefore.docs).map((t) => t + span),
    sinceMs,
    now
  );
  const sparkOf = (list: { createdAt?: string | null }[]) =>
    reportBuckets(timesOf(list), sinceMs, now).buckets.map((b) => b.count);
  const downloadRows = actions.filter((row) => DOWNLOADS.has(row.name));
  const cardRows = actions.filter((row) => row.name === "card-created");

  const visits: Visit[] = rows.map((row) => ({
    page: row.path || "—",
    device: deviceName(row),
    at: row.createdAt ? new Date(row.createdAt).getTime() : 0,
  }));

  const tz = { timeZone: "Europe/Berlin" } as const;
  const periodLabel = `${new Date(sinceMs).toLocaleDateString("de-DE", tz)} – ${new Date(now).toLocaleDateString("de-DE", tz)}`;
  const chart = {
    ...reportBuckets(timesOf(rows), sinceMs, now),
    before: beforeChart.buckets.map((b) => b.count),
  };

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "https://ccm.mxwr.de";
  const adminUrl = `${serverUrl}/admin/globals/analytics`;
  const title = `${interval.label}report`;
  const viewsDelta = compare(total, viewsBefore.docs.length);
  const downloadsDelta = compare(downloads, downloadsBefore);
  const cardsDelta = compare(cards, cardsBefore);

  const text = [
    `Cookie Cutter Maker · ${title} — ${periodLabel}`,
    "",
    `Seitenaufrufe: ${total}${viewsDelta ? ` (${viewsDelta.text})` : ""}`,
    `Downloads: ${downloads}${downloadsDelta ? ` (${downloadsDelta.text})` : ""}`,
    `Karten erstellt: ${cards}${cardsDelta ? ` (${cardsDelta.text})` : ""}`,
    "",
    "Seiten:",
    textList(byPage, total),
    "",
    "Geräte:",
    textList(byDevice, total),
    "",
    "Quellen (ohne interne Navigation):",
    textList(bySource, sourceRows.length),
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
  // The chart as a picture – without one (or if it fails) the mail draws
  // columns instead.
  const beforeShown = chart.before.some((n) => n > 0)
    ? chart.before
    : undefined;
  // Every picture on its own: one failing leaves the others.
  const picture = <T>(make: () => Promise<T>) =>
    make().catch((error) => {
      console.error("[stats-digest] picture failed:", error);
      return null;
    });
  const byClass = tally(rows.map((row) => row.device));
  const sparks = {
    views: chart.buckets.map((b) => b.count),
    downloads: sparkOf(downloadRows),
    cards: sparkOf(cardRows),
  };
  const [png, ring, viewsSpark, downloadsSpark, cardsSpark] = await Promise.all(
    [
      picture(() => viewsChartPng(chart.buckets, beforeShown)),
      picture(() => ringPng(deviceParts(byClass), total, "Aufrufe")),
      picture(() => sparkPng(sparks.views)),
      picture(() => sparkPng(sparks.downloads)),
      picture(() => sparkPng(sparks.cards)),
    ]
  );
  const inline = [
    ...(png
      ? [{ filename: "seitenaufrufe.png", contentId: CHART_ID, content: png }]
      : []),
    ...(ring
      ? [{ filename: "geraete.png", contentId: "devices-ring", content: ring }]
      : []),
    ...(viewsSpark
      ? [
          {
            filename: "verlauf-aufrufe.png",
            contentId: "spark-views",
            content: viewsSpark,
          },
        ]
      : []),
    ...(downloadsSpark
      ? [
          {
            filename: "verlauf-downloads.png",
            contentId: "spark-downloads",
            content: downloadsSpark,
          },
        ]
      : []),
    ...(cardsSpark
      ? [
          {
            filename: "verlauf-karten.png",
            contentId: "spark-cards",
            content: cardsSpark,
          },
        ]
      : []),
  ];
  const html = renderReportHtml({
    title,
    period: periodLabel,
    adminUrl,
    tiles: [
      {
        label: "Seitenaufrufe",
        value: total,
        delta: viewsDelta,
        spark: sparks.views,
        sparkImage: viewsSpark ? "cid:spark-views" : undefined,
      },
      {
        label: "Downloads",
        value: downloads,
        delta: downloadsDelta,
        spark: sparks.downloads,
        sparkImage: downloadsSpark ? "cid:spark-downloads" : undefined,
      },
      {
        label: "Karten erstellt",
        value: cards,
        delta: cardsDelta,
        spark: sparks.cards,
        sparkImage: cardsSpark ? "cid:spark-cards" : undefined,
      },
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
    ],
    chart: { ...chart, image: png ? `cid:${CHART_ID}` : undefined },
    devices: byClass,
    devicesImage: ring ? "cid:devices-ring" : undefined,
    visits,
    sources: bySource,
    actions: actionList,
  });

  return {
    subject: `Cookie Cutter Maker · ${interval.label}-Statistik: ${total} Aufrufe, ${downloads} Downloads`,
    text,
    html,
    total,
    inline,
  };
};
