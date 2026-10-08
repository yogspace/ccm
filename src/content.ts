import { readFile } from "node:fs/promises";
import path from "node:path";
import configPromise from "@payload-config";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import { unstable_cache } from "next/cache";
import { getPayload } from "payload";
import type { Assets, GalleryCard, Preset } from "./assets";
import { TAGS } from "./cache";
import { legalSeed } from "./legal/seed-content";
import { MEDIA_DIR } from "./media";
import { LOCALES, type Locale } from "./seo";
import { SITE_DEFAULTS, type Site } from "./site-defaults";

/** “1-star.svg” → “Star” – in case a template has no name in a language. */
const nameFromFile = (file: string) =>
  file
    .replace(/\.svg$/i, "")
    .replace(/^\d+[-_ ]*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

/** The templates in their order, with the SVG itself and both names. */
const readTemplates = unstable_cache(
  async (): Promise<Preset[]> => {
    const payload = await getPayload({ config: configPromise });
    const { docs } = await payload.find({
      collection: "templates",
      sort: "_order",
      locale: "all",
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });
    const presets = await Promise.all(
      docs.map(async (doc): Promise<Preset | null> => {
        if (!doc.filename) return null;
        try {
          const markup = await readFile(
            path.join(MEDIA_DIR, "templates", doc.filename),
            "utf8"
          );
          // With locale "all" a localized field comes as { de, en }.
          const names = (doc.name ?? {}) as unknown as Partial<
            Record<"de" | "en", string>
          >;
          const fallback = names.de || names.en || nameFromFile(doc.filename);
          return {
            id: String(doc.id),
            name: { de: names.de || fallback, en: names.en || fallback },
            markup,
          };
        } catch {
          // The file is gone (e.g. media not synced locally) – leave it out.
          return null;
        }
      })
    );
    return presets.filter((preset) => preset !== null);
  },
  ["templates"],
  { tags: [TAGS.templates] }
);

/** The gallery's cards – their picture's card size where there is one. */
const readGallery = unstable_cache(
  async (): Promise<GalleryCard[]> => {
    const payload = await getPayload({ config: configPromise });
    const { docs } = await payload.find({
      collection: "gallery",
      sort: "_order",
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });
    return docs.flatMap((doc) => {
      const src = doc.sizes?.card?.url ?? doc.url;
      if (!src) return [];
      return [
        {
          src,
          name: doc.name || doc.alt || "",
          color: doc.color || null,
          built: Boolean(doc.link),
        },
      ];
    });
  },
  ["gallery"],
  { tags: [TAGS.gallery] }
);

/**
 * Templates and gallery pictures for the editor (handed over through
 * assets.ts). Without a database – down, or the build – both stay empty:
 * drawing works anyway, and a failure is not cached.
 */
export const getAssets = async (): Promise<Assets> => {
  const [presets, gallery] = await Promise.all([
    readTemplates().catch(() => []),
    readGallery().catch(() => []),
  ]);
  return { presets, gallery };
};

/** Links, address and card colours from the “Site” global. */
const readSite = unstable_cache(
  async (): Promise<Site> => {
    const payload = await getPayload({ config: configPromise });
    // All languages: the colours' names come as { de, en }.
    const site = await payload.findGlobal({
      slug: "site",
      depth: 0,
      locale: "all",
      overrideAccess: true,
    });
    const rows = (site.cardColors ?? []) as unknown as {
      color?: string;
      name?: Partial<Record<"de" | "en", string>>;
    }[];
    const cardColors = rows
      .filter((row) => row.color)
      .map((row) => ({
        color: row.color as string,
        name: {
          de: row.name?.de || row.name?.en || (row.color as string),
          en: row.name?.en || row.name?.de || (row.color as string),
        },
      }));
    return {
      links: { ...SITE_DEFAULTS.links, ...site.links },
      address: { ...SITE_DEFAULTS.address, ...site.address },
      cardColors: cardColors.length ? cardColors : SITE_DEFAULTS.cardColors,
    };
  },
  ["site"],
  { tags: [TAGS.site] }
);

/** Links, address and card colours – the code's ones without a database. */
export const getSite = (): Promise<Site> =>
  readSite().catch(() => SITE_DEFAULTS);

export type LegalText = {
  content: Record<Locale, SerializedEditorState>;
  updatedAt: string | null;
};

/** The legal text in both languages. */
const readLegal = unstable_cache(
  async (): Promise<LegalText> => {
    const payload = await getPayload({ config: configPromise });
    const legal = await payload.findGlobal({
      slug: "legal",
      locale: "all",
      depth: 0,
      overrideAccess: true,
    });
    // With locale "all" a localized field comes as { de, en }.
    const content = (legal.content ?? {}) as unknown as Partial<
      Record<Locale, SerializedEditorState>
    >;
    return {
      content: Object.fromEntries(
        LOCALES.map((locale) => [locale, content[locale] ?? legalSeed(locale)])
      ) as LegalText["content"],
      updatedAt: legal.updatedAt ?? null,
    };
  },
  ["legal"],
  { tags: [TAGS.legal] }
);

/** The legal text – as it stood in the code without a database. */
export const getLegal = (): Promise<LegalText> =>
  readLegal().catch(() => ({
    content: Object.fromEntries(
      LOCALES.map((locale) => [locale, legalSeed(locale)])
    ) as unknown as LegalText["content"],
    updatedAt: null,
  }));
