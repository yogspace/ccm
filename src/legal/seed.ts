import type { Payload } from "payload";
import { LOCALES, type Locale } from "../seo";
import { SITE_DEFAULTS } from "../site-defaults";
import { legalSeed } from "./seed-content";

type Mode = "fill" | "replace";
type Result = "set" | "kept";

/**
 * The “Site” global with the links, the address and the card colours as in
 * the code – filled where empty, or set back. Until then the site shows the
 * code's versions anyway (content.ts).
 */
export const seedSite = async (
  payload: Payload,
  mode: Mode
): Promise<Result> => {
  const site = await payload.findGlobal({
    slug: "site",
    depth: 0,
    overrideAccess: true,
  });
  const links = mode === "replace" || !site.links?.website;
  const colors = mode === "replace" || !site.cardColors?.length;
  if (!(links || colors)) return "kept";
  const written = await payload.updateGlobal({
    slug: "site",
    locale: "de",
    overrideAccess: true,
    data: {
      ...(links && {
        links: SITE_DEFAULTS.links,
        address: SITE_DEFAULTS.address,
      }),
      ...(colors && {
        cardColors: SITE_DEFAULTS.cardColors.map(({ color, name }) => ({
          color,
          name: name.de,
        })),
      }),
    },
  });
  // The colours' English names – the same rows, found by their ids.
  if (colors) {
    await payload.updateGlobal({
      slug: "site",
      locale: "en",
      overrideAccess: true,
      data: {
        cardColors: (written.cardColors ?? []).map((row, i) => ({
          id: row.id,
          color: row.color,
          name: SITE_DEFAULTS.cardColors[i]?.name.en ?? row.name,
        })),
      },
    });
  }
  return "set";
};

/**
 * The legal text as it stood in the code – per language: filled while that
 * language has none, or set back.
 */
export const seedLegal = async (
  payload: Payload,
  mode: Mode
): Promise<Record<Locale, Result>> => {
  const results = {} as Record<Locale, Result>;
  for (const locale of LOCALES) {
    const doc = await payload.findGlobal({
      slug: "legal",
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    });
    const content = doc.content as { root?: { children?: unknown[] } } | null;
    if (mode === "fill" && content?.root?.children?.length) {
      results[locale] = "kept";
      continue;
    }
    await payload.updateGlobal({
      slug: "legal",
      locale,
      data: { content: legalSeed(locale) as never },
      overrideAccess: true,
    });
    results[locale] = "set";
  }
  return results;
};
