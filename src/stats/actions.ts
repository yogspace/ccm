/**
 * The actions the statistics count – one list for the beacon (analytics.ts),
 * the route that stores them, the admin and the mail report – with their
 * groups and the highlighted tiles. Import-free, so the browser can use it
 * too.
 */
export const ACTIONS = {
  "download-3mf": { en: "3MF downloads", de: "3MF-Downloads" },
  "download-stl": { en: "STL downloads", de: "STL-Downloads" },
  "cookie-saved": { en: "Saved as cookie", de: "Als Keks gespeichert" },
  "share-open": { en: "Share dialog opened", de: "Teilen geöffnet" },
  "share-link": { en: "Link copied", de: "Link kopiert" },
  "share-image": { en: "Picture shared", de: "Bild geteilt" },
  "save-image": { en: "Picture saved", de: "Bild gespeichert" },
  "card-created": { en: "Cards created", de: "Karten erstellt" },
  "card-turned": { en: "Cards turned over", de: "Karten umgedreht" },
  "card-eaten": { en: "Card cookies eaten", de: "Karten-Kekse aufgegessen" },
  "card-download-3mf": { en: "3MF from a card", de: "3MF von einer Karte" },
  "card-download-stl": { en: "STL from a card", de: "STL von einer Karte" },
  "card-picture": { en: "Card as picture", de: "Karte als Bild" },
  "svg-import": { en: "SVG imports", de: "SVG-Importe" },
  template: { en: "Templates used", de: "Vorlagen genutzt" },
  "download-embossed": {
    en: "Downloads with embossing",
    de: "Downloads mit Prägung",
  },
  "account-created": { en: "Accounts created", de: "Konten angelegt" },
  "account-login": { en: "Logins", de: "Anmeldungen" },
  "account-logout": { en: "Logouts", de: "Abmeldungen" },
  "account-deleted": { en: "Accounts deleted", de: "Konten gelöscht" },
  "cookie-online": { en: "Cookies put online", de: "Kekse online gestellt" },
  "cookie-offline": {
    en: "Cookies taken offline",
    de: "Kekse offline genommen",
  },
  "cookie-replaced": {
    en: "Short links switched to a new version",
    de: "Kurzlinks auf neue Version umgestellt",
  },
} as const;

export type ActionName = keyof typeof ACTIONS;

/** A heading or tile label in the admin (English) and the mail (German). */
type Label = { en: string; de: string };

/**
 * The actions by what they are about – in the admin and the mail report
 * alike; anything new lands in “Other”.
 */
export const ACTION_GROUPS: { title: Label; names: ActionName[] }[] = [
  {
    title: { en: "Making", de: "Erstellen" },
    names: ["cookie-saved", "template", "svg-import"],
  },
  {
    title: { en: "Downloads", de: "Downloads" },
    names: ["download-3mf", "download-stl", "download-embossed"],
  },
  {
    title: { en: "Sharing", de: "Teilen" },
    names: ["share-open", "share-link", "share-image", "save-image"],
  },
  {
    title: { en: "Cards", de: "Karten" },
    names: [
      "card-created",
      "card-turned",
      "card-eaten",
      "card-picture",
      "card-download-3mf",
      "card-download-stl",
    ],
  },
  {
    title: { en: "Accounts", de: "Konten" },
    names: [
      "account-created",
      "account-login",
      "account-logout",
      "account-deleted",
      "cookie-online",
      "cookie-replaced",
      "cookie-offline",
    ],
  },
];

/**
 * The tiles in Overview and the mail after the page views – each with its
 * course and the comparison with before; several names add up in one tile.
 * With Visitors and Page views in front they make four: a row of three, the
 * fourth across the next row.
 */
export const HIGHLIGHTS: { label: Label; names: ActionName[] }[] = [
  {
    label: { en: "Downloads (3MF + STL)", de: "Downloads" },
    names: [
      "download-3mf",
      "download-stl",
      "card-download-3mf",
      "card-download-stl",
    ],
  },
  {
    label: { en: "Cards created", de: "Karten erstellt" },
    names: ["card-created"],
  },
];

export const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export const isActionName = (value: unknown): value is ActionName =>
  typeof value === "string" && value in ACTIONS;

/** “3MF downloads” – the name itself for anything unknown (older rows). */
export const actionLabel = (name: string, lang: "de" | "en" = "en") =>
  isActionName(name) ? ACTIONS[name][lang] : name;
