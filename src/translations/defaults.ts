import { de } from "../i18n/de";
import { en } from "../i18n/en";
import type { Locale } from "../seo";

/**
 * The interface texts as they stand in the code (i18n/de.ts, i18n/en.ts) –
 * the SEED of the Translations global, flattened to keys: “draw.presets”.
 *
 * The keys are also the global's FIELDS (translations/tree.ts): a new key in
 * de.ts is a field in the admin after the next start, filled with its text
 * from here (translations/seed.ts). Existing values are never overwritten –
 * what is edited in the admin has the last word.
 */
type Tree = { [key: string]: Tree | string };

const flatten = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`)
  );

const english = new Map(flatten(en));

export const TRANSLATION_DEFAULTS: Record<
  string,
  Record<Locale, string>
> = Object.fromEntries(
  flatten(de).map(([key, text]) => [
    key,
    { de: text, en: english.get(key) ?? text },
  ])
);

export const TRANSLATION_KEYS = Object.keys(TRANSLATION_DEFAULTS);

/** All texts of a language as a flat key–value list. */
export const defaultsFor = (locale: Locale): Record<string, string> =>
  Object.fromEntries(
    TRANSLATION_KEYS.map((key) => [key, TRANSLATION_DEFAULTS[key][locale]])
  );

/** Back from flat keys to the nested form i18next reads. */
export const unflatten = (flat: Record<string, string>): Tree => {
  const root: Tree = {};
  for (const [key, value] of Object.entries(flat)) {
    const segments = key.split(".");
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      if (typeof node[segment] !== "object") node[segment] = {};
      node = node[segment] as Tree;
    }
    node[segments[segments.length - 1]] = value;
  }
  return root;
};

/** The texts of both languages, nested – what the pages hand to i18next. */
export type Texts = Record<Locale, Tree>;
