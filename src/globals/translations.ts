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
 * field here; the Seeds page fills it with its text from the code and
 * deletes keys the code no longer has (translations/seed.ts). Until then the
 * site shows the code's text. What is changed here wins.
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
  fields: translationFields(TRANSLATION_KEYS, TRANSLATION_DEFAULTS),
};
