// Client-safe: the admin page imports this – no seed code may come in here.

/**
 * The seeds: what the code brings along for the CMS. They run from their own
 * admin page (admin/seeds-view.tsx), not at start or deploy. “Fill” only adds
 * what is missing; “Replace” – where offered, behind a confirmation – sets it
 * back to the code's version.
 */
export const SEEDS = ["translations", "site", "legal"] as const;

export type SeedKey = (typeof SEEDS)[number];

export const isSeedKey = (value: unknown): value is SeedKey =>
  SEEDS.includes(value as SeedKey);

/** Seeds that can also reset what is there, behind a confirmation. */
export const seedCanReplace: Record<SeedKey, boolean> = {
  translations: false,
  site: true,
  legal: true,
};

/** The page's path in the admin. */
export const SEEDS_PATH = "/seeds";

export interface SeedResponse {
  summary?: string;
  error?: string;
}

export const SEED_TEXTS: Record<
  SeedKey,
  { title: string; description: string; replaceWarning?: string }
> = {
  translations: {
    title: "Translations",
    description:
      "Adds missing interface texts and removes unused ones. Edited texts stay as they are.",
  },
  site: {
    title: "Site",
    description:
      "Links and address as in the code. Fill only sets them while they are empty.",
    replaceWarning:
      "Links and address go back to the code's version. Edits made to them are lost.",
  },
  legal: {
    title: "Legal",
    description:
      "The imprint and privacy text as in the code, in German and English. Fill only sets a language that has none.",
    replaceWarning:
      "The legal text goes back to the code's version in both languages. Edits made to it are lost.",
  },
};
