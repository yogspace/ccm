import { readFile } from "node:fs/promises";
import path from "node:path";
import configPromise from "@payload-config";
import { unstable_cache } from "next/cache";
import { getPayload } from "payload";
import type { Assets, Preset } from "./assets";
import { TAGS } from "./cache";
import { MEDIA_DIR } from "./media";

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

/** The gallery pictures – their card size where there is one. */
const readGallery = unstable_cache(
  async (): Promise<string[]> => {
    const payload = await getPayload({ config: configPromise });
    const { docs } = await payload.find({
      collection: "gallery",
      sort: "_order",
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });
    return docs.flatMap((doc) => {
      const url = doc.sizes?.card?.url ?? doc.url;
      return url ? [url] : [];
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
