import type { Payload } from "payload";
import { LOCALES } from "../seo";
import { defaultsFor, TRANSLATION_KEYS } from "./defaults";
import { setValueAt, valueAt } from "./tree";

export type SeedReport = {
  locale: string;
  existing: number;
  missing: string[];
};

/**
 * Fills empty texts of the Translations global from the code, per language.
 * Runs at every start (payload.config `onInit`) – a new text is there right
 * after the deploy – and from the button in the admin.
 *
 * Existing values are NEVER overwritten: what is written in the admin is the
 * deliberate choice and beats the code's text.
 */
export const seedTranslations = async (
  payload: Payload,
  { apply = true }: { apply?: boolean } = {}
): Promise<SeedReport[]> => {
  const reports: SeedReport[] = [];

  for (const locale of LOCALES) {
    // Without language fallback: otherwise an empty English field would
    // return the German text, look filled and never be filled.
    const doc = (await payload.findGlobal({
      slug: "translations",
      locale,
      fallbackLocale: false,
      depth: 0,
    })) as unknown as Record<string, unknown>;

    const missing = TRANSLATION_KEYS.filter(
      (key) => !valueAt(doc, key)?.trim()
    );
    reports.push({
      locale,
      existing: TRANSLATION_KEYS.length - missing.length,
      missing,
    });
    if (!(apply && missing.length)) continue;

    const defaults = defaultsFor(locale);
    const data: Record<string, unknown> = {};
    for (const key of TRANSLATION_KEYS) {
      setValueAt(data, key, valueAt(doc, key)?.trim() || defaults[key]);
    }
    await payload.updateGlobal({
      slug: "translations",
      locale,
      data,
      // The afterChange hook expires the cache – and revalidateTag throws
      // outside of a request, so always at start.
      context: { disableRevalidate: true },
    });
  }
  return reports;
};
