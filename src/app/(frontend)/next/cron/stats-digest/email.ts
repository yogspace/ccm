import { pathName } from "@/stats/page-names";
import {
  buildVisitMatrix,
  OTHER,
  type Visit,
  visitShade,
} from "@/stats/visit-matrix";

/**
 * The mail report as HTML – tiles, columns, heatmap, lists, in the app's
 * colours: the blue page, cream cards, ink text, neon pink for what went
 * down.
 *
 * Built for mail programs, not browsers: tables and inline styles only, no
 * grid, no flexbox, no CSS variables, no script. Where a program cannot do
 * something (rounded corners in classic Outlook), it falls back to a quiet
 * surface instead of breaking. `color-scheme: light` so mail programs do not
 * darken and recolour it.
 */

const TZ = "Europe/Berlin";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Fixed colours – mail programs know no variables. The app's tokens
// (index.css): --page, --card, --border, --text, --muted, --accent, --neon.
const C = {
  bg: "#2a44ff",
  onBg: "#ffffff",
  onBgMuted: "rgba(255,255,255,0.74)",
  card: "#fdf8ef",
  line: "#e9dfcb",
  ink: "#0d1033",
  text: "#0d1033",
  muted: "#5c6080",
  data: "#2a44ff",
  // The running bar: held back, but clearly data – not grey.
  dataSoft: "#8c9bff",
  down: "#ff47d0",
  empty: "#d9cfbb",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Heatmap steps on the cream ground, from the app's soft accent to its blue
// and the night blue of dark mode – dark = many.
const RAMP = [
  "#e3e7ff",
  "#c4cdff",
  "#9aa8ff",
  "#6b7cff",
  "#2a44ff",
  "#1f33c9",
  "#141c86",
] as const;

/** What comes from outside (paths, browser names) never goes raw into HTML. */
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (n: number) => n.toLocaleString("de-DE");

// ─── Time in Berlin ──────────────────────────────────────────────────────────
// The server runs in UTC, the report's days and hours are Berlin's –
// otherwise “Monday” would start at two in the night.

const partsFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
});

const berlin = (t: number) => {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(new Date(t)).map((p) => [p.type, p.value])
  );
  return {
    weekday: (parts.weekday ?? "").replace(/\.$/, ""),
    day: parts.day ?? "",
    month: parts.month ?? "",
    year: parts.year ?? "",
    hour: parts.hour ?? "",
  };
};

// Without toLocaleString's comma: in narrow columns it broke right there.
const berlinStamp = (at: number) =>
  new Date(at)
    .toLocaleString("de-DE", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");

// ─── Columns ─────────────────────────────────────────────────────────────────

export type ReportBucket = {
  label: string;
  count: number;
  tick: boolean;
  /** Still running – the report ends “now”, in the middle of this one. */
  partial: boolean;
};

/**
 * Columns over the period – EVERY hour or day, even without views. Up to
 * three days in hours, beyond in days, as in the admin. Gone through hour by
 * hour, so the clock change (23- or 25-hour day) is no special case.
 */
export const reportBuckets = (
  times: number[],
  sinceMs: number,
  nowMs: number
): { grain: "hour" | "day"; buckets: ReportBucket[] } => {
  const grain = nowMs - sinceMs <= 3 * DAY_MS + HOUR_MS ? "hour" : "day";
  const keyOf = (t: number) => {
    if (grain === "hour") return String(t - (t % HOUR_MS));
    const b = berlin(t);
    return `${b.year}-${b.month}-${b.day}`;
  };
  const counts = new Map<string, number>();
  for (const t of times) {
    const key = keyOf(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const multiDay = nowMs - sinceMs > DAY_MS + HOUR_MS;
  const buckets: ReportBucket[] = [];
  const seen = new Set<string>();
  for (let t = sinceMs - (sinceMs % HOUR_MS); t < nowMs; t += HOUR_MS) {
    const key = keyOf(t);
    if (seen.has(key)) continue;
    seen.add(key);
    const b = berlin(t);
    const hour = Number(b.hour);
    buckets.push(
      grain === "hour"
        ? {
            label: multiDay && hour === 0 ? `${b.weekday} ${b.day}.` : b.hour,
            count: counts.get(key) ?? 0,
            tick: multiDay ? hour % 12 === 0 : hour % 3 === 0,
            partial: false,
          }
        : {
            label: `${b.day}.${b.month}.`,
            count: counts.get(key) ?? 0,
            tick: true,
            partial: false,
          }
    );
  }
  const last = buckets.at(-1);
  if (last) last.partial = true;
  if (grain === "day" && buckets.length > 16) {
    buckets.forEach((bucket, i) => {
      bucket.tick = i % 7 === 0 || i === buckets.length - 1;
    });
  }
  return { grain, buckets };
};

// ─── Building blocks ─────────────────────────────────────────────────────────

const card = (inner: string, pad = "16px 18px") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${C.card};border-radius:16px;"><tr><td style="padding:${pad};">${inner}</td></tr></table>`;

const sectionTitle = (title: string, aside = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;"><tr>
    <td style="font-size:13px;font-weight:600;color:${C.ink};">${title}</td>
    <td style="font-size:12px;color:${C.muted};text-align:right;white-space:nowrap;">${aside}</td>
  </tr></table>`;

const gap = (px: number) =>
  `<div style="height:${px}px;line-height:${px}px;font-size:1px;">&nbsp;</div>`;

type Trend = "up" | "down" | "flat";

export type Delta = { text: string; trend: Trend };

/** Against the same span before – as in the admin's tiles. */
export const compare = (now: number, before: number | null): Delta | null => {
  if (before === null) return null;
  // Short, so it fits one line in the narrow tile on a phone.
  if (before === 0) {
    return now > 0
      ? { text: "vorher 0", trend: "up" }
      : { text: "auch vorher 0", trend: "flat" };
  }
  const change = Math.round(((now - before) / before) * 100);
  return {
    text: `${change > 0 ? "+" : ""}${change} % · vorher ${fmt(before)}`,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
};

const TREND_ICON: Record<Trend, string> = { up: "▲", down: "▼", flat: "■" };
const TREND_COLOR: Record<Trend, string> = {
  up: C.data,
  down: C.down,
  flat: C.muted,
};

export type Tile = {
  label: string;
  value: number;
  detail?: string;
  delta?: Delta | null;
};

const tile = ({ label, value, detail, delta }: Tile) => {
  const sub = delta
    ? `<div style="font-size:11px;line-height:15px;color:${TREND_COLOR[delta.trend]};padding-top:6px;"><span style="font-size:8px;">${TREND_ICON[delta.trend]}</span> ${escapeHtml(delta.text)}</div>`
    : detail
      ? `<div style="font-size:11px;line-height:15px;color:${C.muted};padding-top:6px;">${escapeHtml(detail)}</div>`
      : "";
  return card(
    `<div style="font-size:11px;line-height:14px;color:${C.muted};">${label}</div>
     <div style="font-size:26px;line-height:32px;font-weight:700;color:${C.ink};padding-top:4px;letter-spacing:-0.01em;">${fmt(value)}</div>
     ${sub}`,
    "14px 16px"
  );
};

// ─── Column chart ────────────────────────────────────────────────────────────

const PLOT_H = 110;

/**
 * Columns as a table – every column a cell, the bar a block of fixed height:
 * the form every mail program draws the same. A number only at the tallest
 * bar; the running hour or day lighter.
 */
const chartHtml = (buckets: ReportBucket[]) => {
  const n = buckets.length;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const peak = buckets.findIndex((b) => b.count === max && b.count > 0);
  const pad = n > 48 ? 0 : 1;
  // Narrow bars like in the admin (at most 24 px); `max-width` so it fits
  // the narrower cell on a phone.
  const barW = Math.max(3, Math.min(24, Math.round((520 / n) * 0.65)));

  const bars = buckets
    .map((b, i) => {
      const h = b.count ? Math.max(3, Math.round((b.count / max) * PLOT_H)) : 0;
      const label =
        i === peak
          ? `<div style="font-size:10px;line-height:12px;color:${C.text};text-align:center;white-space:nowrap;padding-bottom:3px;">${fmt(b.count)}</div>`
          : "";
      const bar = h
        ? `<div style="height:${h}px;line-height:${h}px;font-size:1px;width:${barW}px;max-width:100%;margin:0 auto;background:${b.partial ? C.dataSoft : C.data};border-radius:3px 3px 0 0;">&nbsp;</div>`
        : "";
      return `<td valign="bottom" style="vertical-align:bottom;height:${PLOT_H + 16}px;padding:0 ${pad}px;">${label}${bar}</td>`;
    })
    .join("");

  // Labels: one cell per tick, reaching to the next.
  const labels: string[] = [];
  for (let i = 0; i < n; ) {
    let j = i + 1;
    while (j < n && !buckets[j].tick) j++;
    labels.push(
      `<td colspan="${j - i}" style="padding:6px 0 0;font-size:10px;line-height:12px;color:${C.muted};white-space:nowrap;text-align:left;">${buckets[i].tick ? escapeHtml(buckets[i].label) : "&nbsp;"}</td>`
    );
    i = j;
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;">
    <tr>${bars}</tr>
    <tr><td colspan="${n}" style="height:1px;line-height:1px;font-size:1px;background:${C.line};">&nbsp;</td></tr>
    <tr>${labels.join("")}</tr>
  </table>`;
};

// ─── Heatmap ─────────────────────────────────────────────────────────────────

/** Row name: page and language instead of the path. */
const rowName = (key: string) => {
  const name = pathName(key);
  return name
    ? `<span style="color:${C.text};">${escapeHtml(name.label)}</span> <span style="color:${C.muted};font-size:10px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(name.locale.toUpperCase())}</span>`
    : `<span style="color:${C.text};">${escapeHtml(key)}</span>`;
};

/**
 * Pages × devices – the admin's grid (stats/visit-matrix), without clicking.
 * Four device columns: a grid scrolling sideways in a mail program nobody
 * reads; the rest stands in “Other”.
 */
const matrixHtml = (visits: Visit[]) => {
  if (!visits.length) {
    return `<div style="color:${C.muted};font-size:12px;">Keine Aufrufe im Zeitraum.</div>`;
  }
  const { columns, rows, cell, columnTotal, max } = buildVisitMatrix(visits, {
    rowAxis: "page",
    maxColumns: 4,
  });

  const head = columns
    .map((col) => {
      const [first, ...rest] = col === OTHER ? ["Andere"] : col.split(" · ");
      return `<td class="r-mx-cell" style="padding:0 2px 8px;text-align:center;vertical-align:bottom;font-size:11px;line-height:14px;color:${C.text};">${escapeHtml(first)}${rest
        .map(
          (part) =>
            `<br><span style="color:${C.muted};font-size:10px;">${escapeHtml(part)}</span>`
        )
        .join("")}</td>`;
    })
    .join("");

  const body = rows
    .slice(0, 12)
    .map(([row, total]) => {
      const cells = columns
        .map((col) => {
          const value = cell(row, col);
          if (!value) {
            return `<td class="r-mx-cell" style="padding:3px 2px;text-align:center;color:${C.empty};font-size:12px;">·</td>`;
          }
          const index = Math.max(
            0,
            Math.min(
              RAMP.length - 1,
              Math.ceil(visitShade(value.count, max) * RAMP.length) - 1
            )
          );
          const ink = index >= 4 ? "#ffffff" : C.ink;
          return `<td class="r-mx-cell" style="padding:3px 2px;"><div title="${value.count} · zuletzt ${berlinStamp(value.lastAt)}" style="background:${RAMP[index]};color:${ink};border-radius:6px;text-align:center;font-size:12px;line-height:26px;font-weight:600;">${value.count}</div></td>`;
        })
        .join("");
      return `<tr>
        <td class="r-mx-label" style="padding:5px 10px 5px 0;vertical-align:middle;border-top:1px solid ${C.line};font-size:12px;line-height:16px;">
          ${rowName(row)}<br>
          <span class="r-wrap" style="color:${C.muted};font-size:10px;white-space:nowrap;">${total.count} · zuletzt ${berlinStamp(total.lastAt)}</span>
        </td>${cells}</tr>`;
    })
    .join("");

  const foot = columns
    .map((col) => {
      const total = columnTotal(col);
      return `<td class="r-mx-cell" style="padding:8px 2px 0;text-align:center;font-size:10px;line-height:13px;color:${C.muted};border-top:1px solid ${C.line};">${
        total
          ? `<span style="color:${C.text};font-size:12px;font-weight:600;">${total.count}</span><br>${berlinStamp(total.lastAt)}`
          : ""
      }</td>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td></td>${head}</tr>
    ${body}
    <tr><td style="padding:8px 10px 0 0;font-size:10px;line-height:13px;color:${C.muted};border-top:1px solid ${C.line};">${visits.length} gesamt<br>je Gerät · zuletzt</td>${foot}</tr>
  </table>`;
};

// ─── Lists ───────────────────────────────────────────────────────────────────

/** Ranking with a thin bar – like the admin's lists. */
const rankList = (entries: [string, number, string?][], limit = 8) => {
  if (!entries.length) {
    return `<div style="color:${C.muted};font-size:12px;">Nichts im Zeitraum.</div>`;
  }
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${entries
    .slice(0, limit)
    .map(
      ([name, count, detail]) => `<tr>
        <td style="padding:7px 12px 7px 0;border-top:1px solid ${C.line};font-size:12px;line-height:16px;color:${C.text};">${escapeHtml(name)}${detail ? ` <span style="color:${C.muted};font-size:11px;">${escapeHtml(detail)}</span>` : ""}
          <div style="height:3px;line-height:3px;font-size:1px;background:${C.data};opacity:0.6;border-radius:2px;width:${Math.max(2, Math.round((count / max) * 100))}%;margin-top:5px;">&nbsp;</div>
        </td>
        <td style="padding:7px 0;border-top:1px solid ${C.line};font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;vertical-align:top;">${fmt(count)}</td>
      </tr>`
    )
    .join("")}</table>`;
};

// ─── The mail ────────────────────────────────────────────────────────────────

export type ReportData = {
  /** “Wochenreport” … */
  title: string;
  period: string;
  adminUrl: string;
  /** Five tiles: three in the first row, two in the second. */
  tiles: Tile[];
  chart: { grain: "hour" | "day"; buckets: ReportBucket[] };
  visits: Visit[];
  sources: [string, number][];
  actions: { label: string; count: number; before: number }[];
};

/**
 * Line breaks between tags away – the template is indented for reading, the
 * mail need not be (Gmail clips mails above 102 KB). Only whitespace WITH a
 * line break: a single space between two spans belongs to the text.
 */
const compact = (html: string) => html.replace(/>\s*\n\s*</g, "><").trim();

/** Width of the mail on large screens. */
const MAX_W = 960;

/**
 * The responsive part – as a media query in <head>, inline styles know none.
 * Apple Mail, iOS, Gmail and Outlook.com read it; classic Outlook keeps the
 * desktop grid. On the phone: tiles one below the other, less margin.
 */
const RESPONSIVE_CSS = `
@media only screen and (max-width: 620px) {
  .r-outer { padding: 20px 10px 32px !important; }
  .r-col { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; box-sizing: border-box !important; }
  .r-hide { display: none !important; }
  .r-mx-label { padding-right: 4px !important; }
  .r-mx-cell { padding-left: 1px !important; padding-right: 1px !important; }
  .r-wrap { white-space: normal !important; }
}
`;

const renderHtml = (r: ReportData): string => {
  // `r-col`: one below the other on the phone (media query).
  const col = (inner: string, side: "left" | "mid" | "right") =>
    `<td class="r-col" width="33.33%" style="width:33.33%;vertical-align:top;padding:${
      side === "left" ? "0 5px 0 0" : side === "right" ? "0 0 0 5px" : "0 5px"
    };">${inner}</td>`;
  const sides = ["left", "mid", "right"] as const;
  const row = (tiles: Tile[]) =>
    `<tr>${tiles.map((t, i) => col(tile(t), sides[i])).join("")}${
      tiles.length < 3 ? '<td class="r-hide"></td>' : ""
    }</tr>`;

  const kpis = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;">
    ${row(r.tiles.slice(0, 3))}
    <tr class="r-hide"><td colspan="3">${gap(10)}</td></tr>
    ${row(r.tiles.slice(3, 6))}
  </table>`;

  const chartTotal = r.chart.buckets.reduce((sum, b) => sum + b.count, 0);
  const chart = card(
    `${sectionTitle(
      r.chart.grain === "hour"
        ? "Seitenaufrufe pro Stunde"
        : "Seitenaufrufe pro Tag",
      `${fmt(chartTotal)} gesamt`
    )}${chartTotal ? chartHtml(r.chart.buckets) : `<div style="color:${C.muted};font-size:12px;">Keine Aufrufe im Zeitraum.</div>`}`
  );

  const matrix = card(
    `${sectionTitle("Seiten × Geräte")}${matrixHtml(r.visits)}`
  );
  const sources = card(
    `${sectionTitle("Quellen", "ohne interne Navigation")}${rankList(r.sources)}`
  );
  const actions = card(
    `${sectionTitle("Aktionen", "im Vergleich zum Zeitraum davor")}${rankList(
      r.actions.map((a) => [a.label, a.count, `vorher ${fmt(a.before)}`]),
      20
    )}`
  );

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(r.title)}</title>
<style>${RESPONSIVE_CSS}</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.bg};">
<tr><td class="r-outer" align="center" style="padding:32px 16px 44px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:${MAX_W}px;font-family:${FONT};color:${C.text};">

  <tr><td style="padding:0 4px 18px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${C.onBgMuted};">🍪 Cookie Cutter Maker · Analytics</td></tr>

  <tr><td style="padding:0 4px 20px;">
    <div style="font-size:30px;line-height:36px;font-weight:800;color:${C.onBg};letter-spacing:-0.02em;">${escapeHtml(r.title)}</div>
    <div style="font-size:13px;line-height:18px;color:${C.onBgMuted};padding-top:4px;">${escapeHtml(r.period)}</div>
  </td></tr>

  <tr><td>${kpis}</td></tr>
  <tr><td>${gap(10)}</td></tr>
  <tr><td>${chart}</td></tr>
  <tr><td>${gap(10)}</td></tr>
  <tr><td>${actions}</td></tr>
  <tr><td>${gap(10)}</td></tr>
  <tr><td>${matrix}</td></tr>
  <tr><td>${gap(10)}</td></tr>
  <tr><td>${sources}</td></tr>

  <tr><td style="padding:28px 4px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
      <td style="background:${C.card};border-radius:999px;">
        <a href="${escapeHtml(r.adminUrl)}" style="display:inline-block;padding:12px 20px;color:${C.ink};font-size:13px;font-weight:700;text-decoration:none;">Analytics im Admin öffnen →</a>
      </td>
    </tr></table>
    <div style="font-size:11px;line-height:16px;color:${C.onBgMuted};padding-top:12px;">Anonyme Statistik – keine IP, keine Cookies.</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

export const renderReportHtml = (r: ReportData): string =>
  compact(renderHtml(r));
