/**
 * Names for the paths – for the admin and the mail report alike: “/en/card”
 * reads as “Card (EN)”. Anything else (bots probing paths) keeps its path.
 */
export type PathName = { label: string; locale: string };

const PAGES: Record<string, string> = { "": "Editor", card: "Card" };

export const pathName = (path: string): PathName | null => {
  const match = path.match(/^\/(de|en)(?:\/(card))?\/?$/);
  if (!match) return null;
  return { label: PAGES[match[2] ?? ""], locale: match[1] };
};

/** “Card (EN)” – for places that only take text. */
export const pathLabel = (path: string) => {
  const name = pathName(path);
  return name ? `${name.label} (${name.locale.toUpperCase()})` : path;
};
