import { revalidateTag } from "next/cache";

/**
 * What the pages take from the CMS, cached until it changes – one tag each.
 * Saving in the admin expires the tag (hooks in collections/ and globals/),
 * `/next/revalidate-all` all of them (e.g. after `pnpm payload:db:sync`).
 */
export const TAGS = {
  texts: "translations",
  gallery: "gallery",
  templates: "templates",
} as const;

/**
 * Expires cache tags AT ONCE. In Next 16 a plain `revalidateTag(tag)` is
 * stale-while-revalidate: the next visitor still gets the old content and
 * only starts the rebuild – after saving one had to reload twice. `{ expire:
 * 0 }` renders anew on the next request. (`updateTag` would be the instant
 * one, but throws outside server actions – Payload's hooks run in its REST
 * route handler.)
 */
export const expireTags = (...tags: string[]) => {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
};

/**
 * Hooks that expire a tag when a document changes or goes – skipped when the
 * change comes with `context.disableRevalidate` (seeding at start, where
 * revalidateTag throws outside of a request).
 */
export const expireOnChange = (tag: string) => ({
  afterChange: [
    ({ doc, context }: { doc: unknown; context?: Record<string, unknown> }) => {
      if (!context?.disableRevalidate) expireTags(tag);
      return doc;
    },
  ],
  afterDelete: [
    ({ doc, context }: { doc: unknown; context?: Record<string, unknown> }) => {
      if (!context?.disableRevalidate) expireTags(tag);
      return doc;
    },
  ],
});
