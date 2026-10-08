"use client";

import { createContext, useContext } from "react";
import { type CardColor, SITE_DEFAULTS, type SiteLinks } from "./site-defaults";

/**
 * The site's links from the CMS (“Site” global) – handed over by the pages
 * (editor and card), read by the footer, the sun cookie and the card's
 * “made by”.
 */
export const SiteLinksContext = createContext<SiteLinks>(SITE_DEFAULTS.links);

export const useSiteLinks = () => useContext(SiteLinksContext);

/** The greeting cards' favourite colours from the CMS (“Site” global). */
export const CardColorsContext = createContext<CardColor[]>(
  SITE_DEFAULTS.cardColors
);

export const useCardColors = () => useContext(CardColorsContext);

/** Fallback while the CMS has none (it always keeps one). */
const BLUE = "#2a44ff";

/**
 * A favourite colour by its number (as in the card's link) – an unknown
 * number is the first, the default. `chosen`: the number that counts.
 */
export const useCardColor = (index: number) => {
  const colors = useCardColors();
  const chosen = index >= 0 && index < colors.length ? index : 0;
  return { chosen, glaze: colors[chosen]?.color ?? BLUE };
};
