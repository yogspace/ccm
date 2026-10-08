"use client";

import { useEffect, useState } from "react";
import { trackView } from "../analytics";
import { type Assets, AssetsContext } from "../assets";
import { setCookieColors } from "../cookies/dough";
import { setupI18n } from "../i18n";
import { CardColorsContext, SiteLinksContext } from "../site-context";
import type { CardColor, CookieColors, SiteLinks } from "../site-defaults";
import type { Texts } from "../translations/defaults";
import CardPage from "./card-page";

trackView();

// Render once Pally is there – the ring text is measured in it.
const fontReady = Promise.race([
  document.fonts.load('600 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

/** The greeting card in the browser – loaded by card-root.tsx. */
export type CardProps = {
  texts: Texts;
  links: SiteLinks;
  colors: CardColor[];
  cookies: CookieColors;
  /** The legal text for the imprint in the footer, rendered on the server. */
  legal: Assets["legal"];
};

const CardEntry = ({ texts, links, colors, cookies, legal }: CardProps) => {
  setupI18n(texts);
  // The cookies' colors from the CMS, before the first one is baked; their
  // sprinkles in the card colors and white.
  setCookieColors({
    ...cookies,
    sprinkles: [...colors.map(({ color }) => color), "#ffffff"],
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontReady.finally(() => setReady(true));
  }, []);
  return ready ? (
    <SiteLinksContext value={links}>
      <CardColorsContext value={colors}>
        {/* No templates or gallery here – just the imprint's text. */}
        <AssetsContext value={{ presets: [], gallery: [], legal }}>
          <CardPage />
        </AssetsContext>
      </CardColorsContext>
    </SiteLinksContext>
  ) : null;
};

export default CardEntry;
