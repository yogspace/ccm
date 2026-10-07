/**
 * The site's links and the owner's address as they were before the CMS – the
 * defaults of the “Site” global (globals/site.ts), what it is seeded with at
 * the first start, and what the pages fall back to without a database.
 */
export type SiteLinks = {
  /** mxwr.de – the footer link and the card's “made by”. */
  website: string;
  makerworld: string;
  /** “Buy me a cookie” (PayPal). */
  donate: string;
  /** The source code. */
  source: string;
};

export type SiteAddress = {
  name: string;
  street: string;
  city: string;
  country: string;
};

export type Site = { links: SiteLinks; address: SiteAddress };

export const SITE_DEFAULTS: Site = {
  links: {
    // The origin in the URL, so visits from here show up in mxwr.de's
    // statistics – even when a browser strips the referrer.
    website: "https://mxwr.de/?utm_source=ccm.mxwr.de&utm_medium=referral",
    makerworld: "https://makerworld.com/@yogspace",
    donate: "https://paypal.me/yogspace",
    source: "https://github.com/yogspace/ccm",
  },
  address: {
    name: "Maximilian Weber",
    street: "Waltherstraße 2",
    city: "64289 Darmstadt",
    country: "Deutschland",
  },
};

export const SITE_LINK_LABELS: Record<keyof SiteLinks, string> = {
  website: "Website (mxwr.de)",
  makerworld: "MakerWorld",
  donate: "Buy me a cookie (PayPal)",
  source: "Source code (GitHub)",
};
