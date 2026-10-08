"use client";

import { useEffect, useState } from "react";
import { trackView } from "../analytics";
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
};

const CardEntry = ({ texts, links, colors }: CardProps) => {
  setupI18n(texts);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontReady.finally(() => setReady(true));
  }, []);
  return ready ? (
    <SiteLinksContext value={links}>
      <CardColorsContext value={colors}>
        <CardPage />
      </CardColorsContext>
    </SiteLinksContext>
  ) : null;
};

export default CardEntry;
