import type { Payload } from "payload";
import { LOCALES } from "../seo";
import { SITE_DEFAULTS } from "../site-defaults";
import { legalSeed } from "./seed-content";

/**
 * The “Site” global with the links and the address as they were before the
 * CMS – once, while it is empty (payload.config `onInit`).
 */
export const seedSite = async (payload: Payload) => {
  const site = await payload.findGlobal({
    slug: "site",
    depth: 0,
    overrideAccess: true,
  });
  if (site.links?.website) return;
  await payload.updateGlobal({
    slug: "site",
    data: SITE_DEFAULTS,
    overrideAccess: true,
    // revalidateTag throws outside of a request – and there is nothing cached yet.
    context: { disableRevalidate: true },
  });
};

/**
 * The legal text as it stood in the code – per language, while that language
 * has none. What is written in the admin is never touched.
 */
export const seedLegal = async (payload: Payload) => {
  for (const locale of LOCALES) {
    const doc = await payload.findGlobal({
      slug: "legal",
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    });
    const content = doc.content as { root?: { children?: unknown[] } } | null;
    if (content?.root?.children?.length) continue;
    await payload.updateGlobal({
      slug: "legal",
      locale,
      data: { content: legalSeed(locale) as never },
      overrideAccess: true,
      context: { disableRevalidate: true },
    });
  }
};
