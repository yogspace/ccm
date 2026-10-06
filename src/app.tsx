import {
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Rotate3d,
  Ruler,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import Button from "./components/button";
import CookieBackground from "./components/cookie-background";
import CookieBar from "./components/cookie-bar";
import CookieIcon from "./components/cookie-icon";
import DonateBadge from "./components/donate-badge";
import DrawCanvas from "./components/draw-canvas";
import ErrorPopup from "./components/error-popup";
import ExportButtons from "./components/export-buttons";
import GalleryFan from "./components/gallery-fan";
import LegalNotice from "./components/legal-notice";
import Masthead from "./components/masthead";
import ParameterPanel from "./components/parameter-panel";
import Preview3d, { type PreviewHandle } from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import SettingsBar from "./components/settings-bar";
import ShareCreation from "./components/share-creation";
import SharePanel from "./components/share-panel";
import { PORTFOLIO_URL } from "./links";
import { connectStore, store, toggleAutoRotate, toggleExpanded } from "./store";
import { formatLength, numberFormat } from "./units";

/**
 * The page's frame. The store (store.ts) holds the state; components read it
 * themselves – here only what the frame shows directly.
 */
const App = () => {
  const { t, i18n } = useTranslation();
  // Synchronous, so the switch animates as a view transition (toggleExpanded).
  const { expanded } = useSnapshot(store, { sync: true });
  const { cutter, unit, autoRotate, creations } = useSnapshot(store);
  const { ready, mesh } = cutter;
  const preview = useRef<PreviewHandle>(null);

  // Hook worker, link in the hash, counter and scroll lock up to the store.
  useEffect(connectStore, []);

  const lang = i18n.resolvedLanguage ?? "en";

  return (
    <div className="app">
      <CookieBackground />
      <Masthead />

      <main className="layout" data-expanded={expanded || undefined}>
        <SettingsBar>
          <SharePanel />
        </SettingsBar>

        <section className="card shape-card">
          <div className="card-head">
            <h2>{t("steps.shape")}</h2>
            <Button
              aria-label={t(expanded ? "draw.shrink" : "draw.expand")}
              aria-pressed={expanded}
              className="icon expand"
              onClick={toggleExpanded}
              title={t(expanded ? "draw.shrink" : "draw.expand")}
              type="button"
            >
              <CookieIcon
                icing="#2a44ff"
                icon={expanded ? Minimize2 : Maximize2}
                roll={-10}
                size={52}
              />
            </Button>
          </div>
          <DrawCanvas />
          <ErrorPopup />
        </section>

        <section className="card cutter-card">
          <div className="card-head">
            <h2>{t("steps.cutter")}</h2>
            <div className="card-tools">
              {mesh && (
                <span className="dims">
                  <CookieIcon
                    icing="#2a44ff"
                    icon={Ruler}
                    roll={35}
                    size={46}
                  />
                  {mesh.dimensions
                    .map((d) =>
                      formatLength(d, unit, lang, unit === "in" ? 2 : 0)
                    )
                    .join(" × ")}
                </span>
              )}
              <Button
                aria-label={t("preview.rotate")}
                aria-pressed={autoRotate}
                className="icon rotate"
                onClick={toggleAutoRotate}
                title={t("preview.rotate")}
                type="button"
              >
                <CookieIcon icon={Rotate3d} roll={12} size={52} />
              </Button>
            </div>
          </div>

          {/* The slot takes the room left; the view in it stays roughly square. */}
          <div className="viewer-slot">
            <div className="stage viewer paper">
              <Preview3d ref={preview} />
              {!mesh && (
                <div className="stage-hint">
                  <CookieIcon kind="star" size={120} spin={!ready} />
                  <span>
                    {ready ? t("preview.empty") : t("preview.loading")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <ParameterPanel />

          <div className="export">
            <PrintHints />
            <ExportButtons />
          </div>
        </section>
      </main>

      {/* The end of the page: the fan floats, and right in front of it the
          creation can be shared. */}
      <div className="showcase">
        <GalleryFan />
        <div className="card share-box">
          <ShareCreation preview={preview} />
        </div>
      </div>

      {/* Floats at the bottom while scrolling, stops right above the footer. */}
      <CookieBar />

      <footer>
        <DonateBadge />
        <span className="footer-links">
          <a href={PORTFOLIO_URL} rel="noopener" target="_blank">
            mxwr.de
            <CookieIcon icon={ArrowUpRight} size={40} />
          </a>
          <span aria-hidden className="sep">
            ·
          </span>
          <a
            href="https://makerworld.com/@yogspace"
            rel="noopener"
            target="_blank"
          >
            MakerWorld
            <CookieIcon icing="#5fb36b" icon={ArrowUpRight} size={40} />
          </a>
        </span>
        {creations !== null && (
          <span className="creations">
            {t("footer.creations", {
              count: creations,
              formatted: numberFormat(lang, 0).format(creations),
            })}
          </span>
        )}
        <span className="credit">
          <LegalNotice />
          <span aria-hidden className="sep">
            ·
          </span>
          <span>© {new Date().getFullYear()} Maximilian Weber</span>
        </span>
      </footer>
    </div>
  );
};

export default App;
