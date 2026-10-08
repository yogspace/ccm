"use client";

import { useEffect, useState } from "react";
import { trackView } from "../analytics";
import { type Assets, AssetsContext } from "../assets";
import { setupI18n } from "../i18n";
import { CardColorsContext, SiteLinksContext } from "../site-context";
import type { CardColor, SiteLinks } from "../site-defaults";
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
  /** The legal text for the imprint in the footer, rendered on the server. */
  legal: Assets["legal"];
};

const CardEntry = ({ texts, links, colors, legal }: CardProps) => {
  setupI18n(texts);
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
