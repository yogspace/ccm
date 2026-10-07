import configPromise from "@payload-config";
import { unstable_cache } from "next/cache";
import { getPayload } from "payload";
import { TAGS } from "../cache";
import { LOCALES, type Locale } from "../seo";
import {
  defaultsFor,
  type Texts,
  TRANSLATION_KEYS,
  unflatten,
} from "./defaults";
import { flattenTranslations } from "./tree";

type Stored = Record<Locale, Record<string, string>>;

/**
 * What the global holds, flat, for both languages – cached until it is
 * saved. Throws if the database is not there (a failure is not cached).
 */
const readStored = unstable_cache(
  async (): Promise<Stored> => {
    const payload = await getPayload({ config: configPromise });
    const entries = await Promise.all(
      LOCALES.map(async (locale) => {
        const doc = await payload.findGlobal({
          slug: "translations",
          locale,
          depth: 0,
        });
        return [locale, flattenTranslations(doc, TRANSLATION_KEYS)] as const;
      })
    );
    return Object.fromEntries(entries) as Stored;
  },
  ["translations"],
  { tags: [TAGS.texts] }
);

/**
 * The interface texts of both languages for a page: the global's, and the
 * code's where it has none – a key just added in the code, a field emptied in
 * the admin, or no database at all (down, or the build). Mixed in after the
 * cache, so a new key in the code shows even before the global has it.
 */
export const getTexts = async (): Promise<Texts> => {
  const stored = await readStored().catch(() => null);
  return Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      unflatten({ ...defaultsFor(locale), ...stored?.[locale] }),
    ])
  ) as Texts;
};
