import type { Field } from "payload";

/**
 * Translation keys as a tree – for the global's fields and back. Every dot is
 * a group level: a group `draw` holding `presets`, `undo` … The keys in the
 * code stay the same – stored nested, read flat again.
 *
 * Without runtime imports from Payload: the config, the seeding and the
 * pages all need this file.
 */
type Tree = { [segment: string]: Tree | string };

/**
 * Names Mongoose reserves for its documents – a field called `errors` or
 * `save` can break validation and saving. Such a segment is stored as
 * `errors_`; the key in the code and the label in the admin stay the same.
 */
const RESERVED = new Set([
  "collection",
  "db",
  "emit",
  "errors",
  "get",
  "init",
  "isModified",
  "isNew",
  "listeners",
  "on",
  "populated",
  "remove",
  "removeListener",
  "save",
  "schema",
  "set",
  "toObject",
  "validate",
]);

const fieldName = (segment: string) =>
  RESERVED.has(segment) ? `${segment}_` : segment;

/**
 * Builds the tree; a leaf carries the full key. A key that is also the
 * prefix of another (“a.b” next to “a.b.c”) would be a field AND a group in
 * the same place – that throws here, at start, instead of silently dropping
 * one of the texts later.
 */
const buildTree = (keys: string[]): Tree => {
  const root: Tree = {};
  for (const key of [...keys].sort()) {
    const segments = key.split(".");
    let node = root;
    segments.forEach((segment, index) => {
      const existing = node[segment];
      if (index === segments.length - 1) {
        if (existing !== undefined) {
          throw new Error(`Translation key collides with a group: ${key}`);
        }
        node[segment] = key;
        return;
      }
      if (typeof existing === "string") {
        throw new Error(`Translation key collides with a group: ${existing}`);
      }
      node[segment] = existing ?? {};
      node = node[segment] as Tree;
    });
  }
  return root;
};

/**
 * The global's fields from the keys. The top level as a collapsible section
 * (closed when opening – otherwise 130 fields would stand one below the
 * other), in it an unnamed-looking group that nests the data. Deeper levels
 * as ordinary groups with a title.
 *
 * Under every field the code's text in both languages – whoever changes a
 * text sees what it started from and can restore it after a mistake.
 */
export const translationFields = (
  keys: string[],
  defaults: Record<string, Partial<Record<string, string>>>
): Field[] => {
  const leaf = (name: string, key: string): Field => {
    const texts = defaults[key] ?? {};
    const description = Object.entries(texts)
      .map(([locale, text]) => `${locale.toUpperCase()}: ${text}`)
      .join("  ·  ");
    const field = {
      name: fieldName(name),
      label: name,
      localized: true,
      admin: { description: description || undefined },
    } as const;
    // Longer texts get room for more than one line.
    return Object.values(texts).some((text) => (text?.length ?? 0) > 80)
      ? { ...field, type: "textarea" }
      : { ...field, type: "text" };
  };

  const children = (tree: Tree, depth: number): Field[] =>
    Object.entries(tree).map(([name, value]) => {
      if (typeof value === "string") return leaf(name, value);
      const group: Field = {
        name: fieldName(name),
        type: "group",
        label: depth === 0 ? false : name,
        admin: depth === 0 ? { hideGutter: true } : undefined,
        fields: children(value, depth + 1),
      };
      if (depth > 0) return group;
      return {
        type: "collapsible",
        label: name,
        admin: { initCollapsed: true },
        fields: [group],
      };
    });

  return children(buildTree(keys), 0);
};

/** Where a key is stored: “draw.presets”, a reserved segment as `errors_`. */
export const storedPath = (key: string) =>
  key.split(".").map(fieldName).join(".");

/** The value at a key path (“draw.presets”) in nested data. */
export const valueAt = (data: unknown, key: string): string | undefined => {
  let node: unknown = data;
  for (const segment of key.split(".")) {
    if (!node || typeof node !== "object") return;
    node = (node as Record<string, unknown>)[fieldName(segment)];
  }
  return typeof node === "string" ? node : undefined;
};

/** Sets a value at a key path, creating missing levels. */
export const setValueAt = (
  data: Record<string, unknown>,
  key: string,
  value: string
): void => {
  const segments = key.split(".").map(fieldName);
  let node = data;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (!next || typeof next !== "object") node[segment] = {};
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
};

/**
 * The stored texts as a flat list again, as the code reads them – only the
 * known keys (not `id`, `updatedAt` …), and without empty values, so the
 * caller falls back to the code's text instead of an empty one.
 */
export const flattenTranslations = (
  data: unknown,
  keys: string[]
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = valueAt(data, key)?.trim();
    if (value) result[key] = value;
  }
  return result;
};
