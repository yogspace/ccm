"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { trackView } from "../analytics";
import { type Assets, AssetsContext } from "../assets";
import { setCookieColors } from "../cookies/dough";
import { createI18n, followLanguage } from "../i18n";
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
  // The page's language is its path's (/de/card, /en/card), on <html>.
  const [i18n] = useState(() =>
    createI18n(texts, document.documentElement.lang || "en")
  );
  useEffect(() => followLanguage(i18n), [i18n]);
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
    <I18nextProvider i18n={i18n}>
      <SiteLinksContext value={links}>
        <CardColorsContext value={colors}>
          {/* No templates or gallery here – just the imprint's text. */}
          <AssetsContext value={{ presets: [], gallery: [], legal }}>
            <CardPage />
          </AssetsContext>
        </CardColorsContext>
      </SiteLinksContext>
    </I18nextProvider>
  ) : null;
};

export default CardEntry;
