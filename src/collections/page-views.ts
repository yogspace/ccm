import type { CollectionConfig, Field } from "payload";
import { authenticated } from "../access/authenticated";
import { TRACKING } from "../stats/config";

/**
 * Anonymous page views – one row per view, holding ONLY coarse dimensions
 * derived from what the browser sends by itself in every request:
 *
 *   - path:     which page (/de, /en/card …)
 *   - referrer: a coarse source group (Google, Instagram, direct …)
 *   - device:   mobile / tablet / desktop
 *   - os:       "iOS 18", "Android 14", "macOS" …
 *   - browser:  "Safari 18", "Chrome 141" …
 *
 * No IP, no cookie – and nothing is read out of the device (screen size,
 * fonts, canvas): that would be access under § 25 TDDDG, need consent and
 * turn a coarse dimension into a fingerprint. Only major versions are kept.
 *
 * The options in stats/config.ts add fields: country, region, city and
 * language (`origin`), the campaign (`campaigns`), the visit and its step
 * (`visits` –
 * then the views of one visit are linked, and the privacy policy says so),
 * the visible seconds and when the page was left (`timing`).
 *
 * Written only by /next/track (local API). Pruned after RETENTION_DAYS by
 * the stats-digest cron.
 */
const optional: Field[] = [
  ...(TRACKING.origin
    ? [
        { name: "country", type: "text", index: true } as Field,
        { name: "region", type: "text" } as Field,
        { name: "city", type: "text" } as Field,
        { name: "language", type: "text" } as Field,
      ]
    : []),
  ...(TRACKING.campaigns
    ? [{ name: "campaign", type: "text", index: true } as Field]
    : []),
  ...(TRACKING.timing
    ? // The page's own random id – what the time sent later finds it by.
      [{ name: "view", type: "text", index: true } as Field]
    : []),
  ...(TRACKING.visits
    ? [
        { name: "visit", type: "text", index: true } as Field,
        { name: "step", type: "number" } as Field,
      ]
    : []),
  ...(TRACKING.timing
    ? [
        { name: "seconds", type: "number" } as Field,
        { name: "endedAt", type: "date" } as Field,
      ]
    : []),
];

export const PageViews: CollectionConfig = {
  slug: "page-views",
  admin: {
    hidden: true,
    useAsTitle: "path",
    defaultColumns: [
      "path",
      "referrer",
      "device",
      "os",
      "browser",
      "createdAt",
    ],
  },
  access: {
    create: () => false,
    delete: authenticated,
    read: authenticated,
    update: () => false,
  },
  fields: [
    { name: "path", type: "text", required: true, index: true },
    { name: "referrer", type: "text", index: true },
    { name: "device", type: "text" },
    { name: "os", type: "text" },
    { name: "browser", type: "text" },
    ...optional,
  ],
};
