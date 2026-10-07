import type { GlobalAfterChangeHook, GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireTags, TAGS } from "../cache";
import {
  TRANSLATION_DEFAULTS,
  TRANSLATION_KEYS,
} from "../translations/defaults";
import { translationFields } from "../translations/tree";

/**
 * Fresh texts on the site right after saving (see cache.ts). Skipped for the
 * seeding at start, where revalidateTag throws outside of a request.
 */
const revalidateTexts: GlobalAfterChangeHook = ({ doc, context }) => {
  if (!context?.disableRevalidate) expireTags(TAGS.texts);
  return doc;
};

/**
 * The interface texts of editor and card, in German and English. The fields
 * come from the keys in the code (translations/defaults.ts): “draw.presets”
 * is the field `presets` in the group `draw`. A new key in the code is a new
 * field here after the next start, filled with its text from the code (see
 * translations/seed.ts) – what is changed here wins.
 */
export const Translations: GlobalConfig = {
  slug: "translations",
  label: "Translations",
  admin: { group: "Content" },
  access: {
    read: () => true,
    update: authenticated,
  },
  hooks: { afterChange: [revalidateTexts] },
  fields: [
    {
      name: "seed",
      type: "ui",
      admin: {
        components: {
          Field: "@/fields/seed-translations-button#SeedTranslationsButton",
        },
      },
    },
    ...translationFields(TRANSLATION_KEYS, TRANSLATION_DEFAULTS),
  ],
};
