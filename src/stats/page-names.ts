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

/** A page in a language, counted – `page` null for anything else (bots). */
export type PagePart = {
  page: string | null;
  locale: string | null;
  count: number;
};

/**
 * Page views as parts of a whole – each page in each language, in a fixed
 * order (Editor DE, Editor EN, Card DE, Card EN), anything else last as one
 * part: the admin's and the mail's “Pages” ring.
 */
export const pageParts = (paths: (string | null | undefined)[]) => {
  const counts = new Map<string, number>();
  let other = 0;
  for (const path of paths) {
    const name = path ? pathName(path) : null;
    if (!name) {
      other += 1;
      continue;
    }
    const key = `${name.label}|${name.locale}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts: PagePart[] = Object.values(PAGES).flatMap((page) =>
    ["de", "en"].flatMap((locale) => {
      const count = counts.get(`${page}|${locale}`);
      return count ? [{ page, locale, count }] : [];
    })
  );
  return other ? [...parts, { page: null, locale: null, count: other }] : parts;
};

/** “Card (EN)” for a part – `other` for the rest, in the reader's language. */
export const partLabel = (part: PagePart, other: string) =>
  part.page && part.locale
    ? `${part.page} (${part.locale.toUpperCase()})`
    : other;
