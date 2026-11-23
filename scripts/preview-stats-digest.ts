// biome-ignore-all lint/suspicious/noConsole: CLI script, output is intended
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import configPromise from "@payload-config";
import { getPayload } from "payload";
import { buildDigest } from "@/app/(frontend)/next/cron/stats-digest/digest";

// The mail report WITHOUT sending it: built from the data in DATABASE_URL,
// the HTML written to a file – pictures as data URLs, so a browser shows
// them.
//
//   pnpm payload run scripts/preview-stats-digest.ts            (7 days)
//   DAYS=1 pnpm payload run scripts/preview-stats-digest.ts     (daily)
//   OUT=/tmp/r.html pnpm payload run scripts/preview-stats-digest.ts
//
// As environment variables, not flags: `payload run` swallows its own
// arguments. For real data use a copy of production in a database of its
// own (DATABASE_URL pointing at it only for this), never production itself.
const DAYS = Number(process.env.DAYS ?? 7);
// By default into `preview/` in the repo – git-ignored: the files hold real
// analytics.
const OUT =
  process.env.OUT ?? join(process.cwd(), "preview", "stats-digest.html");

const LABEL = DAYS <= 1 ? "Tages" : DAYS <= 7 ? "Wochen" : "Monats";

const payload = await getPayload({ config: configPromise });
const now = Date.now();
const { subject, html, text, total, inline } = await buildDigest(payload, {
  sinceMs: now - DAYS * 24 * 60 * 60 * 1000,
  now,
  interval: { label: LABEL },
});

// The embedded pictures (`cid:…`) as data URLs. Longer ids first:
// “views-chart” is the start of “views-chart-phone”.
let shown = html;
for (const file of [...inline].sort(
  (a, b) => b.contentId.length - a.contentId.length
)) {
  shown = shown.replaceAll(
    `cid:${file.contentId}`,
    `data:image/png;base64,${file.content.toString("base64")}`
  );
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, shown);
writeFileSync(OUT.replace(/\.html$/, ".txt"), text);
console.log(`${subject} — ${total} page views`);
// What Gmail measures: the HTML as sent, pictures attached – clipped above
// 102 KB.
console.log(
  `HTML as sent: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, ${inline.length} pictures`
);
console.log(`HTML: ${OUT}`);
process.exit(0);
