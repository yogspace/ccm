import { ACTION_GROUPS } from "@/stats/actions";
import { type PagePart, partLabel } from "@/stats/page-names";
import { CHART_W, PHONE_W, RING_SIZE, SPARK_W } from "./chart-image";

/**
 * The mail report as HTML – tiles, columns, rings, lists, in the app's
 * colors: the blue page, cream cards, ink text, neon pink for what went
 * down.
 *
 * Built for mail programs, not browsers: tables and inline styles only, no
 * grid, no flexbox, no CSS variables, no script. Where a program cannot do
 * something (rounded corners in classic Outlook), it falls back to a quiet
 * surface instead of breaking. `color-scheme: light` so mail programs do not
 * darken and recolor it.
 */

const TZ = "Europe/Berlin";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Fixed colors – mail programs know no variables. The app's tokens
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
  // The period before and a figure's course: quiet, beside the data.
  before: "#c9bfab",
  track: "#efe6d4",
} as const;

// Device classes in fixed colors – brand blue, brand orange, aqua (checked
// on the cream ground; the numbers always stand beside them).
const DEVICES: Record<string, { name: string; color: string }> = {
  desktop: { name: "Desktop", color: "#2a44ff" },
  mobile: { name: "Mobil", color: "#ff6a1f" },
  tablet: { name: "Tablet", color: "#1baf7a" },
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Heatmap and map steps on the cream ground, from the app's soft accent to
// its blue and the night blue of dark mode – dark = many.
export const RAMP = [
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
  /** The value as text instead of a count – “1,4” pages per visitor. */
  display?: string;
  detail?: string;
  delta?: Delta | null;
  /** Its course over the period – small columns under the number … */
  spark?: number[];
  /** … or, where it could be drawn, as a picture (`cid:…`). */
  sparkImage?: string;
  /** Its share of a whole (0…1) – a thin track under the number. */
  share?: number;
};

/**
 * A figure's course as tiny columns – grey, the last one blue, like the
 * admin's sparklines. Cells, not a picture: every mail program draws them.
 */
const sparkHtml = (values: number[]) => {
  if (values.length < 2) return "";
  const max = Math.max(...values, 1);
  const H = 22;
  const cells = values
    .map((v, i) => {
      const h = v ? Math.max(2, Math.round((v / max) * H)) : 1;
      const color = i === values.length - 1 ? C.data : v ? C.before : C.track;
      return `<td valign="bottom" style="vertical-align:bottom;height:${H}px;padding:0 ${values.length > 40 ? 0 : 1}px;"><div style="height:${h}px;line-height:${h}px;font-size:1px;background:${color};border-radius:1px;">&nbsp;</div></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;margin-top:10px;"><tr>${cells}</tr></table>`;
};

/** A share as a thin track – for “63 of 223 views”. */
const meterHtml = (share: number) => {
  const pct = Math.max(2, Math.min(100, Math.round(share * 100)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:12px;"><tr>
    <td width="${pct}%" style="height:6px;line-height:6px;font-size:1px;background:${C.data};border-radius:3px;">&nbsp;</td>
    ${pct < 100 ? `<td style="height:6px;line-height:6px;font-size:1px;background:${C.track};border-radius:3px;">&nbsp;</td>` : ""}
  </tr></table>`;
};

const tile = ({
  label,
  value,
  display,
  detail,
  delta,
  spark,
  sparkImage,
  share,
}: Tile) => {
  const sub = delta
    ? `<div style="font-size:11px;line-height:15px;color:${TREND_COLOR[delta.trend]};padding-top:6px;"><span style="font-size:8px;">${TREND_ICON[delta.trend]}</span> ${escapeHtml(delta.text)}</div>`
    : detail
      ? `<div style="font-size:11px;line-height:15px;color:${C.muted};padding-top:6px;">${escapeHtml(detail)}</div>`
      : "";
  return card(
    `<div style="font-size:11px;line-height:14px;color:${C.muted};">${label}</div>
     <div style="font-size:26px;line-height:32px;font-weight:700;color:${C.ink};padding-top:4px;letter-spacing:-0.01em;">${escapeHtml(display ?? fmt(value))}</div>
     ${sub}${sparkImage ? `<img src="${escapeHtml(sparkImage)}" width="${SPARK_W}" alt="" style="display:block;width:100%;max-width:${SPARK_W}px;height:auto;border:0;margin-top:10px;">` : spark ? sparkHtml(spark) : ""}${share !== undefined ? meterHtml(share) : ""}`,
    "14px 16px"
  );
};

// ─── Column chart ────────────────────────────────────────────────────────────

const PLOT_H = 110;

/**
 * Columns as a table – every column a cell, the bar a block of fixed height:
 * the form every mail program draws the same. A number only at the tallest
 * bar; the running hour or day lighter. With `before`, the same hour or day
 * of the period before stands as a grey column beside each.
 */
const chartHtml = (buckets: ReportBucket[], before?: number[]) => {
  const n = buckets.length;
  const max = Math.max(...buckets.map((b) => b.count), ...(before ?? []), 1);
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
      const was = before?.[i] ?? 0;
      if (before) {
        // Side by side in a little table: grey before, blue now.
        const bh = was ? Math.max(3, Math.round((was / max) * PLOT_H)) : 0;
        const ghost = bh
          ? `<div style="height:${bh}px;line-height:${bh}px;font-size:1px;background:${C.before};border-radius:2px 2px 0 0;">&nbsp;</div>`
          : "";
        const nowBar = h
          ? `<div style="height:${h}px;line-height:${h}px;font-size:1px;background:${b.partial ? C.dataSoft : C.data};border-radius:2px 2px 0 0;">&nbsp;</div>`
          : "";
        return `<td valign="bottom" style="vertical-align:bottom;height:${PLOT_H + 16}px;padding:0 ${pad}px;">${label}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;"><tr><td valign="bottom" style="vertical-align:bottom;width:40%;padding-right:1px;">${ghost}</td><td valign="bottom" style="vertical-align:bottom;width:60%;">${nowBar}</td></tr></table></td>`;
      }
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

// ─── Lists ───────────────────────────────────────────────────────────────────

/** A bar of `pct` % on a cream track, `h` px high. */
const barHtml = (pct: number, color: string, h: number) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${
    // Nothing is nothing – no stub for a zero.
    pct > 0
      ? `<td width="${Math.max(1, pct)}%" style="height:${h}px;line-height:${h}px;font-size:1px;background:${color};border-radius:0 ${h / 2}px ${h / 2}px 0;">&nbsp;</td>`
      : ""
  }<td style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</td></tr></table>`;

/**
 * Ranking as bars from one baseline, the number and the share beside –
 * like the admin's lists.
 */
const rankList = (entries: [string, number, string?][], limit = 8) => {
  if (!entries.length) {
    return `<div style="color:${C.muted};font-size:12px;">Nichts im Zeitraum.</div>`;
  }
  const max = Math.max(...entries.map(([, n]) => n), 1);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${entries
    .slice(0, limit)
    .map(
      ([name, count, detail]) => `<tr>
        <td style="padding:8px 12px 8px 0;font-size:12px;line-height:16px;color:${C.text};">${escapeHtml(name)}${detail ? ` <span style="color:${C.muted};font-size:11px;">${escapeHtml(detail)}</span>` : ""}
          <div style="padding-top:5px;">${barHtml(Math.round((count / max) * 100), C.data, 6)}</div>
        </td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;vertical-align:top;">${fmt(count)} <span style="font-size:11px;font-weight:400;color:${C.muted};">${Math.round((count / total) * 100)} %</span></td>
      </tr>`
    )
    .join("")}</table>`;
};

/**
 * The device classes in their fixed colors, the rest as “Andere” – for the
 * stacked bar and the ring picture alike.
 */
export const deviceParts = (devices: [string, number][]) => {
  const merged = new Map<string, number>();
  for (const [key, count] of devices) {
    const name = DEVICES[key] ? key : "other";
    merged.set(name, (merged.get(name) ?? 0) + count);
  }
  return [...Object.keys(DEVICES), "other"]
    .filter((key) => merged.has(key))
    .map((key) => ({
      name: DEVICES[key]?.name ?? "Andere",
      color: DEVICES[key]?.color ?? C.before,
      count: merged.get(key) ?? 0,
    }));
};

/**
 * Each page in the app's hue – German in it, English in its deep shade –
 * the rest grey: the “Seiten” ring, a part per page and language.
 */
const PAGE_COLORS: Record<string, [string, string]> = {
  Editor: ["#2a44ff", "#141c86"],
  Card: ["#ff6a1f", "#a83f0b"],
};

export const pageRingParts = (parts: PagePart[]) =>
  parts.map((part) => ({
    name: partLabel(part, "Andere"),
    color:
      (part.page && PAGE_COLORS[part.page]?.[part.locale === "en" ? 1 : 0]) ||
      C.before,
    count: part.count,
  }));

/** “Mobil” for “mobile” – a device class as the mail names it. */
export const deviceClassName = (key: string) => DEVICES[key]?.name ?? key;

/**
 * A whole in parts – devices, or pages in their languages: the ring as a
 * picture with the legend beside it, else one stacked bar. `what` names it
 * for the picture's alt text.
 */
const partsHtml = (
  parts: { name: string; color: string; count: number }[],
  what: string,
  ring?: string
) => {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (!total) {
    return `<div style="color:${C.muted};font-size:12px;">Keine Aufrufe im Zeitraum.</div>`;
  }
  const segments = parts
    .map(
      (part, i) =>
        `<td width="${Math.max(1, Math.round((part.count / total) * 100))}%" style="height:14px;line-height:14px;font-size:1px;background:${part.color};${i < parts.length - 1 ? `border-right:2px solid ${C.card};` : ""}${i === 0 ? "border-radius:7px 0 0 7px;" : ""}${i === parts.length - 1 ? "border-radius:0 7px 7px 0;" : ""}${parts.length === 1 ? "border-radius:7px;" : ""}">&nbsp;</td>`
    )
    .join("");
  const legend = parts
    .map(
      (part) => `<tr>
        <td style="padding:7px 0 0;font-size:12px;line-height:16px;color:${C.text};"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${part.color};margin-right:6px;"></span>${part.name}</td>
        <td style="padding:7px 0 0;font-size:13px;font-weight:600;color:${C.ink};text-align:right;white-space:nowrap;">${fmt(part.count)} <span style="font-size:11px;font-weight:400;color:${C.muted};">${Math.round((part.count / total) * 100)} %</span></td>
      </tr>`
    )
    .join("");
  const legendTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;">${legend}</table>`;
  // The ring as a picture, the legend beside it – else one stacked bar.
  if (ring) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
      <td width="${RING_SIZE}" style="width:${RING_SIZE}px;vertical-align:middle;padding-right:18px;"><img src="${escapeHtml(ring)}" width="${RING_SIZE}" height="${RING_SIZE}" alt="${what}: ${parts.map((p) => `${p.name} ${p.count}`).join(", ")}" style="display:block;width:${RING_SIZE}px;height:${RING_SIZE}px;border:0;"></td>
      <td style="vertical-align:middle;">${legendTable}</td>
    </tr></table>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>${segments}</tr></table>${legendTable}`;
};

/**
 * Each action as a blue bar for now and a thin grey one for before, on one
 * scale, the change as a number with an arrow – grouped like in the admin.
 */
const actionsHtml = (actions: ReportAction[]) => {
  if (!actions.length) {
    return `<div style="color:${C.muted};font-size:12px;">Nichts im Zeitraum.</div>`;
  }
  const max = Math.max(...actions.map((a) => Math.max(a.count, a.before)), 1);
  // The groups of the admin (stats/actions.ts), their German titles.
  const grouped = new Set<string>(
    ACTION_GROUPS.flatMap((group) => group.names)
  );
  const groups = [
    ...ACTION_GROUPS.map(({ title, names }) => ({
      title: title.de,
      names: names as string[],
    })),
    {
      title: "Weitere",
      names: actions.map((a) => a.name).filter((name) => !grouped.has(name)),
    },
  ]
    .map((group) => ({
      title: group.title,
      items: group.names.flatMap((name) =>
        actions.filter((a) => a.name === name)
      ),
    }))
    .filter((group) => group.items.length > 0);
  const groupHtml = (list: typeof groups) =>
    list
      .map(
        (
          group
        ) => `<div style="font-size:10px;line-height:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};padding:10px 0 2px;">${group.title}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${group.items
        .map((a) => {
          const diff = a.count - a.before;
          const trend: Trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
          const change =
            diff === 0
              ? "wie vorher"
              : `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`;
          return `<tr>
            <td style="padding:7px 12px 7px 0;font-size:12px;line-height:16px;color:${C.text};">${escapeHtml(a.label)}
              <div style="padding-top:5px;">${barHtml(Math.round((a.count / max) * 100), C.data, 6)}</div>
              <div style="padding-top:2px;">${barHtml(Math.round((a.before / max) * 100), C.before, 3)}</div>
            </td>
            <td style="padding:7px 0;text-align:right;white-space:nowrap;vertical-align:top;font-size:13px;font-weight:600;color:${C.ink};">${fmt(a.count)}<div style="font-size:10px;font-weight:400;color:${TREND_COLOR[trend]};padding-top:2px;"><span style="font-size:7px;">${TREND_ICON[trend]}</span> ${change}</div></td>
          </tr>`;
        })
        .join("")}</table>`
      )
      .join("");
  // Two columns, balanced by rows – the groups stay whole: split where the
  // two sides come closest.
  const sizes = groups.map((group) => group.items.length + 1);
  const rows = sizes.reduce((sum, n) => sum + n, 0);
  let split = 1;
  let filled = 0;
  let best = Number.POSITIVE_INFINITY;
  sizes.forEach((size, i) => {
    filled += size;
    const off = Math.abs(2 * filled - rows);
    if (off < best && i < sizes.length - 1) {
      best = off;
      split = i + 1;
    }
  });
  const left = groups.slice(0, split);
  const right = groups.slice(split);
  if (!right.length) return groupHtml(left);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>
    <td class="r-col" width="50%" style="width:50%;vertical-align:top;padding:0 14px 0 0;">${groupHtml(left)}</td>
    <td class="r-col" width="50%" style="width:50%;vertical-align:top;padding:0 0 0 14px;">${groupHtml(right)}</td>
  </tr></table>`;
};

// ─── Visitors, countries, paths ──────────────────────────────────────────────

export type RecentVisitor = {
  /** “Mo 23.11. 14:05” – in Berlin time, without commas. */
  when: string;
  /** The made-up name (stats/visit-name.ts). */
  name: string;
  /** “🇩🇪 Deutschland” – empty without a country. */
  place: string;
  /** “Desktop · macOS 15 · Safari 18 · von Google”. */
  device: string;
  /** “Editor (DE) → Card (DE)”. */
  path: string;
};

/** The latest visitors, one per row: when, who, from where, their path. */
const recentVisitorsHtml = (list: RecentVisitor[], more: number) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${list
    .map(
      (v) => `<tr>
        <td style="padding:9px 12px 9px 0;border-top:1px solid ${C.line};vertical-align:top;white-space:nowrap;font-size:12px;font-weight:600;color:${C.ink};width:1%;">${escapeHtml(v.when)}</td>
        <td style="padding:9px 0;border-top:1px solid ${C.line};vertical-align:top;font-size:12px;line-height:17px;color:${C.text};">
          <span style="font-weight:600;color:${C.ink};">${escapeHtml(v.name)}</span>${v.place ? ` <span style="color:${C.muted};">· ${escapeHtml(v.place)}</span>` : ""}
          <div style="font-size:11px;color:${C.muted};">${escapeHtml(v.device)}</div>
          <div style="font-size:11px;color:${C.text};padding-top:3px;">${escapeHtml(v.path)}</div>
        </td>
      </tr>`
    )
    .join("")}</table>${
    more > 0
      ? `<div style="color:${C.muted};font-size:11px;padding-top:8px;">+ ${fmt(more)} weitere – alle im Admin unter Analytics → Visitors.</div>`
      : ""
  }`;

/**
 * Under the countries: where they come from and that the IP is not kept.
 * Names the database the lookup uses (stats/geoip.ts, DB-IP IP to Country
 * Lite, CC BY 4.0 – attribution required).
 */
const ORIGIN_NOTE =
  "Nur das Land – aus der IP nachgeschlagen, die nie gespeichert wird. IP Geolocation by DB-IP (CC BY 4.0).";

/**
 * Where visitors come from: the map as a picture across the card, below it
 * the countries and the browser languages side by side (one below the other
 * on the phone).
 */
const countriesHtml = (r: NonNullable<ReportData["origin"]>) => {
  const map = r.image
    ? `<img src="${escapeHtml(r.image)}" width="${r.imageWidth}" alt="Weltkarte: ${escapeHtml(
        r.countries
          .slice(0, 5)
          .map(([name, n]) => `${name} ${n}`)
          .join(", ")
      )}" style="display:block;width:100%;max-width:${r.imageWidth}px;height:auto;border:0;border-radius:8px;">${gap(14)}`
    : "";
  const missing = r.missing
    ? `<div style="color:${C.muted};font-size:11px;padding-top:10px;">${fmt(r.missing)} Aufrufe ohne Land – älter oder eine Adresse, die die Datenbank nicht kennt.</div>`
    : "";
  const half = (inner: string, side: "left" | "right") =>
    `<td class="r-col" width="50%" style="width:50%;vertical-align:top;padding:${side === "left" ? "0 10px 0 0" : "0 0 0 10px"};">${inner}</td>`;
  const heading = (title: string, aside = "") =>
    `<div style="font-size:12px;font-weight:600;color:${C.text};padding-bottom:2px;">${title}${aside ? ` <span style="font-weight:400;color:${C.muted};">${aside}</span>` : ""}</div>`;
  return `${map}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>
    ${half(`${heading("Länder")}${rankList(r.countries)}`, "left")}
    ${half(`${heading("Sprachen", "die erste des Browsers")}${rankList(r.languages)}`, "right")}
  </tr></table>${missing}
  <div style="color:${C.muted};font-size:10px;line-height:14px;padding-top:10px;">${escapeHtml(ORIGIN_NOTE)}</div>`;
};

export type ReportAction = {
  /** Its key (stats/actions) – for the groups. */
  name: string;
  label: string;
  count: number;
  before: number;
};

export type ReportData = {
  /** “Wochenreport” … */
  title: string;
  period: string;
  adminUrl: string;
  /**
   * Groups of tiles (how many · what and how), each in full rows of three:
   * the last tile spans what is left of its row, as in the admin.
   */
  tiles: Tile[][];
  chart: {
    grain: "hour" | "day";
    buckets: ReportBucket[];
    /** The same hours or days of the period before. */
    before?: number[];
    /** The chart as a picture (`cid:…`) – without it, columns … */
    image?: string;
    /** … and the phone's narrower one. */
    phoneImage?: string;
  };
  /** Page views by device class … */
  devices: [string, number][];
  /** … and as a ring picture (`cid:…`), if it could be drawn. */
  devicesImage?: string;
  /** Page views by page and language … */
  pages: PagePart[];
  /** … and as a ring picture (`cid:…`), if it could be drawn. */
  pagesImage?: string;
  sources: [string, number][];
  actions: ReportAction[];
  /** With `TRACKING.visits`: the latest visitors … */
  recentVisitors?: RecentVisitor[];
  /** … and how many more there were. */
  moreVisitors?: number;
  /** With `TRACKING.origin`: countries and languages – null without any. */
  origin?: {
    /** “🇩🇪 Deutschland” by views. */
    countries: [string, number][];
    languages: [string, number][];
    /** The map (`cid:…`), if it could be drawn. */
    image?: string;
    imageWidth: number;
    /** Page views without a country. */
    missing: number;
  } | null;
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
  .r-show { display: block !important; max-height: none !important; overflow: visible !important; }
}
`;

const renderHtml = (r: ReportData): string => {
  // Tiles in full rows of three – the last one of a group spans what is left
  // of its row. Each row a table of its own: no colspan under a fixed
  // layout. `r-col`: one below the other on the phone (media query).
  const tileRow = (tiles: Tile[]) => {
    const cells = tiles.map((t, i) => {
      const from = i;
      const to = i === tiles.length - 1 ? 2 : i;
      const width = `${(((to - from + 1) / 3) * 100).toFixed(2)}%`;
      const padding = `0 ${to === 2 ? 0 : 5}px 0 ${from === 0 ? 0 : 5}px`;
      return `<td class="r-col" width="${width}" style="width:${width};vertical-align:top;padding:${padding};">${tile(t)}</td>`;
    });
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>${cells.join("")}</tr></table>`;
  };
  const tileRows = r.tiles.flatMap((group) => {
    const rows: Tile[][] = [];
    for (let i = 0; i < group.length; i += 3) rows.push(group.slice(i, i + 3));
    return rows;
  });
  // Between rows a gap – on the phone the stacked tiles bring their own.
  const kpis = tileRows
    .map(tileRow)
    .join(`<div class="r-hide">${gap(10)}</div>`);

  const chartTotal = r.chart.buckets.reduce((sum, b) => sum + b.count, 0);
  const beforeTotal = (r.chart.before ?? []).reduce((sum, n) => sum + n, 0);
  const key = (color: string, text: string) =>
    `<span style="display:inline-block;width:10px;height:3px;border-radius:2px;background:${color};vertical-align:middle;margin:0 5px 2px 12px;"></span>${text}`;
  const chart = card(
    `${sectionTitle(
      r.chart.grain === "hour"
        ? "Seitenaufrufe pro Stunde"
        : "Seitenaufrufe pro Tag",
      `${key(C.data, `${fmt(chartTotal)} jetzt`)}${r.chart.before ? key(C.before, `${fmt(beforeTotal)} davor`) : ""}`
    )}${
      !(chartTotal || beforeTotal)
        ? `<div style="color:${C.muted};font-size:12px;">Keine Aufrufe im Zeitraum.</div>`
        : r.chart.image
          ? `<img class="${r.chart.phoneImage ? "r-hide" : ""}" src="${escapeHtml(r.chart.image)}" width="${CHART_W}" alt="Seitenaufrufe: ${fmt(chartTotal)} im Zeitraum${r.chart.before ? `, ${fmt(beforeTotal)} davor` : ""}" style="display:block;width:100%;max-width:${CHART_W}px;height:auto;border:0;">${
              r.chart.phoneImage
                ? // Only on the phone (media query); hidden everywhere else,
                  // classic Outlook included.
                  `<!--[if !mso]><!--><div class="r-show" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><img src="${escapeHtml(r.chart.phoneImage)}" width="${PHONE_W}" alt="Seitenaufrufe: ${fmt(chartTotal)} im Zeitraum${r.chart.before ? `, ${fmt(beforeTotal)} davor` : ""}" style="display:block;width:100%;max-width:${PHONE_W}px;height:auto;border:0;"></div><!--<![endif]-->`
                : ""
            }`
          : chartHtml(r.chart.buckets, beforeTotal ? r.chart.before : undefined)
    }`
  );

  const sources = card(
    `${sectionTitle("Quellen", "ohne interne Navigation")}${rankList(r.sources)}`
  );
  const devices = card(
    `${sectionTitle("Geräte")}${partsHtml(deviceParts(r.devices), "Geräte", r.devicesImage)}`
  );
  const pages = card(
    `${sectionTitle("Seiten")}${partsHtml(pageRingParts(r.pages), "Seiten", r.pagesImage)}`
  );
  const actions = card(
    `${sectionTitle("Aktionen", `${key(C.data, "jetzt")}${key(C.before, "davor")}`)}${actionsHtml(r.actions)}`
  );
  // Pages and devices side by side – one below the other on the phone.
  const pair = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;"><tr>
    <td class="r-col" width="50%" style="width:50%;vertical-align:top;padding:0 5px 0 0;">${pages}</td>
    <td class="r-col" width="50%" style="width:50%;vertical-align:top;padding:0 0 0 5px;">${devices}</td>
  </tr></table>`;
  // What the options in stats/config.ts add – only what has data.
  const visitors = r.recentVisitors?.length
    ? card(
        `${sectionTitle("Letzte Besucher", "Namen erfunden")}${recentVisitorsHtml(r.recentVisitors, r.moreVisitors ?? 0)}`
      )
    : "";
  const origin = r.origin
    ? card(
        `${sectionTitle("Woher die Besucher kommen")}${countriesHtml(r.origin)}`
      )
    : "";
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
  ${[chart, actions, pair, sources, visitors, origin]
    .filter(Boolean)
    .map((part) => `<tr><td>${gap(10)}</td></tr><tr><td>${part}</td></tr>`)
    .join("")}

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
