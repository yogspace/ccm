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

/**
 * A favourite colour a greeting card can have (card composer): the cookie's
 * icing, and in its shades the card, its back and its words. Its place in
 * the list is its number in card links.
 */
export type CardColor = { color: string; name: { de: string; en: string } };

export type Site = {
  links: SiteLinks;
  address: SiteAddress;
  cardColors: CardColor[];
};

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
  // The app's own colours. The first is the default – a card without one.
  cardColors: [
    { color: "#2a44ff", name: { de: "Blau", en: "Blue" } },
    { color: "#ff5fa8", name: { de: "Rosa", en: "Pink" } },
    { color: "#ffc31f", name: { de: "Gelb", en: "Yellow" } },
    { color: "#ff6a1f", name: { de: "Orange", en: "Orange" } },
    { color: "#5fb36b", name: { de: "Grün", en: "Green" } },
    { color: "#a9b6ff", name: { de: "Flieder", en: "Lilac" } },
  ],
};

export const SITE_LINK_LABELS: Record<keyof SiteLinks, string> = {
  website: "Website (mxwr.de)",
  makerworld: "MakerWorld",
  donate: "Buy me a cookie (PayPal)",
  source: "Source code (GitHub)",
};
