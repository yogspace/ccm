import type { BasePayload } from "payload";
import { ACTION_NAMES, actionLabel } from "@/stats/actions";
import { pathLabel } from "@/stats/page-names";
import { tally } from "@/stats/tally";
import { deviceName, type Visit } from "@/stats/visit-matrix";
import { compare, renderReportHtml, reportBuckets } from "./email";

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
): Promise<{ subject: string; text: string; html: string; total: number }> => {
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
      payload.count({
        collection: "page-views",
        where: before,
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

  const visits: Visit[] = rows.map((row) => ({
    page: row.path || "—",
    device: deviceName(row),
    at: row.createdAt ? new Date(row.createdAt).getTime() : 0,
  }));

  const tz = { timeZone: "Europe/Berlin" } as const;
  const periodLabel = `${new Date(sinceMs).toLocaleDateString("de-DE", tz)} – ${new Date(now).toLocaleDateString("de-DE", tz)}`;
  const chart = reportBuckets(
    rows.flatMap((row) =>
      row.createdAt ? [new Date(row.createdAt).getTime()] : []
    ),
    sinceMs,
    now
  );

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "https://ccm.mxwr.de";
  const adminUrl = `${serverUrl}/admin/globals/analytics`;
  const title = `${interval.label}report`;
  const viewsDelta = compare(total, viewsBefore.totalDocs);
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
  const html = renderReportHtml({
    title,
    period: periodLabel,
    adminUrl,
    tiles: [
      { label: "Seitenaufrufe", value: total, delta: viewsDelta },
      { label: "Downloads", value: downloads, delta: downloadsDelta },
      { label: "Karten erstellt", value: cards, delta: cardsDelta },
      {
        label: "Meistbesuchte Seite",
        value: topPage?.[1] ?? 0,
        detail: topPage?.[0] ?? "—",
      },
      {
        label: "Top-Quelle",
        value: topSource?.[1] ?? 0,
        detail: topSource?.[0] ?? "—",
      },
    ],
    chart,
    visits,
    sources: bySource,
    actions: actionList,
  });

  return {
    subject: `Cookie Cutter Maker · ${interval.label}-Statistik: ${total} Aufrufe, ${downloads} Downloads`,
    text,
    html,
    total,
  };
};
