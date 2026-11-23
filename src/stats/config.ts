/**
 * What the statistics collect – one switch for the beacon (analytics.ts), the
 * routes that store it, the collection's fields and the admin's sections.
 * Import-free, so the browser can use it too.
 *
 * All off: anonymous page views and actions – page, coarse source, device
 * class, system, browser. Nothing links two rows. Every option on top widens
 * what is stored – the privacy policy has to say so (see the skill's
 * references/privacy-policy.md).
 */
export const TRACKING = {
  /**
   * Where people are: country, region and city (stats/location.ts – from
   * the CDN's headers or a local GeoIP database; the IP is only looked up,
   * never stored) and the browser's language (Accept-Language, sent by
   * every browser anyway).
   */
  origin: true,
  /** The `utm_source`, `utm_medium` and `utm_campaign` of the first page. */
  campaigns: false,
  /**
   * How people navigate: the page views of one visit linked by a random id
   * that lives only in the page's memory – no cookie, no storage. A reload
   * or a new tab is a new visit. Gives paths, entry and exit pages.
   */
  visits: true,
  /**
   * From when to when: the visible time on each page (a hidden tab does not
   * count), sent when the page is left or hidden. With `visits` also the
   * whole visit: first page to last.
   */
  timing: false,
} as const;

/** Rows are deleted after this many days (cron/stats-digest). */
export const RETENTION_DAYS = 90;

/** More visible time on one page than this counts as this – a forgotten tab. */
export const MAX_SECONDS = 2 * 60 * 60;

/** Dates and numbers in the admin and the mail report. */
export const LOCALE = "de-DE";

/** The mail report's days and hours – the server runs in UTC. */
export const TIME_ZONE = "Europe/Berlin";

/** The site's name at the top of the mail report and in its subject. */
export const SITE_NAME = "Cookie Cutter Maker";
