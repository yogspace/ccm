"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { noteOpened, startAccount } from "./account/client";
import { trackView } from "./analytics";
import { type Assets, AssetsContext } from "./assets";
import { setCookieColors } from "./cookies/dough";
import App from "./editor-app";
import { createI18n, followLanguage } from "./i18n";
import type { Locale } from "./seo";
import { CardColorsContext, SiteLinksContext } from "./site-context";
import type { CardColor, CookieColors, SiteLinks } from "./site-defaults";
import { boot } from "./store";
import type { Texts } from "./translations/defaults";

// Dev server only: a button that saves the drawing as a test case – not in
// the production bundle.
const DevFixture =
  process.env.NODE_ENV === "development"
    ? lazy(() => import("./components/dev-fixture"))
    : null;

export type EditorProps = Assets & {
  texts: Texts;
  links: SiteLinks;
  colors: CardColor[];
  cookies: CookieColors;
  /** The page's language – its path, /de or /en. */
  locale: Locale;
};

/**
 * The editor – rendered on the server as it starts (nothing drawn, the
 * default dimensions), taken over by the browser: right after, what only
 * the browser knows comes in – the link's drawing, the jar and the unit
 * (store.ts `boot`), the account.
 */
const Editor = ({
  texts,
  links,
  colors,
  cookies,
  locale,
  ...assets
}: EditorProps) => {
  // The page's own – on the server, every page has one.
  const [i18n] = useState(() => createI18n(texts, locale));
  // The cookies' colors from the CMS, before the first one is baked; their
  // sprinkles in the card colors and white.
  setCookieColors({
    ...cookies,
    sprinkles: [...colors.map(({ color }) => color), "#ffffff"],
  });
  useEffect(() => followLanguage(i18n), [i18n]);
  useEffect(() => {
    trackView();
    // The link first – a short one made whole – then the account, which
    // knows the model the page was opened with.
    void boot().then(() => {
      noteOpened();
      startAccount();
    });
  }, []);
  return (
    <I18nextProvider i18n={i18n}>
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
    </I18nextProvider>
  );
};

export default Editor;
