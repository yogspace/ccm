"use client";

import { useEffect, useState } from "react";
import { trackView } from "../analytics";
import { setupI18n } from "../i18n";
import type { Texts } from "../translations/defaults";
import CardPage from "./card-page";

trackView();

// Render once Pally is there – the ring text is measured in it.
const fontReady = Promise.race([
  document.fonts.load('600 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

/** The greeting card in the browser – loaded by card-root.tsx. */
const CardEntry = ({ texts }: { texts: Texts }) => {
  setupI18n(texts);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontReady.finally(() => setReady(true));
  }, []);
  return ready ? <CardPage /> : null;
};

export default CardEntry;
