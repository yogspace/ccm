"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { startAccount } from "./account/client";
import { trackView } from "./analytics";
import { type Assets, AssetsContext } from "./assets";
import { setCookieColors } from "./cookies/dough";
import App from "./editor-app";
import { setupI18n } from "./i18n";
import { CardColorsContext, SiteLinksContext } from "./site-context";
import type { CardColor, CookieColors, SiteLinks } from "./site-defaults";
import type { Texts } from "./translations/defaults";

// Dev server only: a button that saves the drawing as a test case – not in
// the production bundle.
const DevFixture =
  process.env.NODE_ENV === "development"
    ? lazy(() => import("./components/dev-fixture"))
    : null;

trackView();

// Render once Pally is there – otherwise the font visibly jumps. If it never
// arrives (e.g. offline), the app starts anyway after a short while.
const fontReady = Promise.race([
  document.fonts.load('700 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

export type EditorProps = Assets & {
  texts: Texts;
  links: SiteLinks;
  colors: CardColor[];
  cookies: CookieColors;
};

/** The editor in the browser – loaded by editor-root.tsx, never rendered on the server. */
const Editor = ({ texts, links, colors, cookies, ...assets }: EditorProps) => {
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
  // The account: logged in here last time, its cookie jar comes along.
  useEffect(() => startAccount(), []);
  if (!ready) return null;
  return (
    <SiteLinksContext value={links}>
      <CardColorsContext value={colors}>
        <AssetsContext value={assets}>
          <App />
          {DevFixture && (
            <Suspense>
              <DevFixture />
            </Suspense>
          )}
        </AssetsContext>
      </CardColorsContext>
    </SiteLinksContext>
  );
};

export default Editor;
