/**
 * The actions the statistics count – one list for the beacon (analytics.ts),
 * the route that stores them, the admin and the mail report. Import-free, so
 * the browser can use it too.
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
  "card-download-3mf": { en: "3MF from a card", de: "3MF von einer Karte" },
  "card-download-stl": { en: "STL from a card", de: "STL von einer Karte" },
  "card-picture": { en: "Card as picture", de: "Karte als Bild" },
  "svg-import": { en: "SVG imports", de: "SVG-Importe" },
  template: { en: "Templates used", de: "Vorlagen genutzt" },
} as const;

export type ActionName = keyof typeof ACTIONS;

export const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export const isActionName = (value: unknown): value is ActionName =>
  typeof value === "string" && value in ACTIONS;

/** “3MF downloads” – the name itself for anything unknown (older rows). */
export const actionLabel = (name: string, lang: "de" | "en" = "en") =>
  isActionName(name) ? ACTIONS[name][lang] : name;
