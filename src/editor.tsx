"use client";

import { useEffect, useState } from "react";
import { trackView } from "./analytics";
import { type Assets, AssetsContext } from "./assets";
import App from "./editor-app";
import { setupI18n } from "./i18n";
import type { Texts } from "./translations/defaults";

// Dev server only: save the drawing as a test case (Alt+Shift+F).
if (process.env.NODE_ENV === "development") {
  import("./dev-fixture").then(({ listenForFixtures }) => listenForFixtures());
}

trackView();

// Render once Pally is there – otherwise the font visibly jumps. If it never
// arrives (e.g. offline), the app starts anyway after a short while.
const fontReady = Promise.race([
  document.fonts.load('700 1em "Pally"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

export type EditorProps = Assets & { texts: Texts };

/** The editor in the browser – loaded by editor-root.tsx, never rendered on the server. */
const Editor = ({ texts, ...assets }: EditorProps) => {
  setupI18n(texts);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontReady.finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <AssetsContext value={assets}>
      <App />
    </AssetsContext>
  );
};

export default Editor;
