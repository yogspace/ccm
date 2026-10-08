import type { MongooseAdapter } from "@payloadcms/db-mongodb";
import type { Payload } from "payload";
import { LOCALES } from "../seo";
import { defaultsFor, TRANSLATION_KEYS } from "./defaults";
import { setValueAt, storedPath, valueAt } from "./tree";

/** What the database keeps beside the texts. */
const META = new Set([
  "_id",
  "id",
  "globalType",
  "createdAt",
  "updatedAt",
  "__v",
]);

/**
 * The paths in a stored Translations document that no key in the code
 * leads to any more – a whole group at once where none of it is used.
 */
export const unusedIn = (
  doc: Record<string, unknown>,
  keys: readonly string[]
): string[] => {
  const leaves = new Set(keys.map(storedPath));
  const groups = new Set(
    [...leaves].flatMap((path) => {
      const segments = path.split(".");
      return segments
        .slice(0, -1)
        .map((_, i) => segments.slice(0, i + 1).join("."));
    })
  );
  const unused: string[] = [];
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [name, value] of Object.entries(node)) {
      if (!prefix && META.has(name)) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      if (leaves.has(path)) continue;
      if (groups.has(path) && value && typeof value === "object") {
        walk(value as Record<string, unknown>, path);
      } else unused.push(path);
    }
  };
  walk(doc, "");
  return unused;
};

/**
 * The stored texts the code no longer has. Payload no longer shows them
 * (the fields come from the code) – but they stay in the database until
 * deleted. Read raw: a removed key is no field anymore.
 */
const unusedPaths = async (payload: Payload): Promise<string[]> => {
  const { globals } = payload.db as unknown as MongooseAdapter;
  const doc = await globals.collection.findOne({ globalType: "translations" });
  return doc ? unusedIn(doc as Record<string, unknown>, TRANSLATION_KEYS) : [];
};

export interface TranslationSeedResult {
  added: string[];
  removed: string[];
  kept: number;
}

/**
 * Aligns the Translations global with the code: a new key gets the code's
 * text, per language; a key the code no longer has is deleted, in both
 * languages. Existing texts are NEVER overwritten – what is written in the
 * admin is the deliberate choice and beats the code's text.
 */
export const syncTranslations = async (
  payload: Payload
): Promise<TranslationSeedResult> => {
  const added: string[] = [];
  let kept = 0;

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
    kept += TRANSLATION_KEYS.length - missing.length;
    added.push(...missing.map((key) => `${locale}:${key}`));
    if (!missing.length) continue;

    const defaults = defaultsFor(locale);
    const data: Record<string, unknown> = {};
    for (const key of TRANSLATION_KEYS) {
      setValueAt(data, key, valueAt(doc, key)?.trim() || defaults[key]);
    }
    await payload.updateGlobal({ slug: "translations", locale, data });
  }

  const removed = await unusedPaths(payload);
  if (removed.length) {
    const { globals } = payload.db as unknown as MongooseAdapter;
    await globals.collection.updateOne(
      { globalType: "translations" },
      { $unset: Object.fromEntries(removed.map((path) => [path, ""])) }
    );
  }
  return { added, removed, kept };
};
