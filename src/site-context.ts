"use client";

import { createContext, useContext } from "react";
import { SITE_DEFAULTS, type SiteLinks } from "./site-defaults";

/**
 * The site's links from the CMS (“Site” global) – handed over by the pages
 * (editor and card), read by the footer, the sun cookie and the card's
 * “made by”.
 */
export const SiteLinksContext = createContext<SiteLinks>(SITE_DEFAULTS.links);

export const useSiteLinks = () => useContext(SiteLinksContext);
