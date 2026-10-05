import {
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Rotate3d,
  Ruler,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import Button from "./components/button";
import CookieBackground from "./components/cookie-background";
import CookieIcon from "./components/cookie-icon";
import DonateBadge from "./components/donate-badge";
import DrawCanvas from "./components/draw-canvas";
import ExportButtons from "./components/export-buttons";
import LegalNotice from "./components/legal-notice";
import Masthead from "./components/masthead";
import ParameterPanel from "./components/parameter-panel";
import Preview3d, { type PreviewHandle } from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import SettingsBar from "./components/settings-bar";
import ShareCreation from "./components/share-creation";
import SharePanel from "./components/share-panel";
import { InputError, type Ring, traceOutline } from "./geometry/outline";
import { useCutter } from "./geometry/use-cutter";
import type { de } from "./i18n/de";
import { PORTFOLIO_URL } from "./links";
import { countCreation, loadCreations } from "./stats";
import {
  formatLength,
  initialUnit,
  numberFormat,
  storeUnit,
  type Unit,
} from "./units";
import { type Drawing, readHash, writeHash } from "./url-state";

type ErrorKey = keyof (typeof de)["errors"];

/** Zustand aus einem geteilten Link – einmal beim Laden gelesen. */
const shared = readHash(window.location.hash);

const App = () => {
  const { t, i18n } = useTranslation();
  // Alte Links bringen die Kontur mit, neue die Zeichnung (→ Kontur per Abtasten).
  const [rings, setRings] = useState<Ring[]>(shared.rings);
  const [drawing, setDrawing] = useState<Drawing>(shared.drawing);
  const [params, setParams] = useState(shared.params);
  const [name, setName] = useState(shared.name);
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [autoRotate, setAutoRotate] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [inputError, setInputError] = useState<ErrorKey>();
  const { ready, mesh, outline, error: cutterError } = useCutter(rings, params);
  const error = inputError ?? cutterError;

  // Maßstab für das Koordinatensystem: so viele mm ist die Zeichenfläche breit.
  const mmPerCanvas = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of outline) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    // Ohne Form: Annahme, dass die Zeichnung etwa 70 % der Fläche füllt.
    const extent = Math.max(maxX - minX, maxY - minY);
    return params.size / (extent > 0 ? extent : 0.7);
  }, [outline, params.size]);

  // Zustand in den Link schreiben, damit er sich jederzeit teilen lässt –
  // erst wenn sich eine Weile nichts tut, nicht bei jeder Reglerbewegung.
  // Gespeichert wird die fertige Kontur, kompakter als die Rohzeichnung.
  useEffect(() => {
    const timer = setTimeout(() => {
      const { pathname, search } = window.location;
      const hash = writeHash({ name, params, drawing });
      window.history.replaceState(null, "", `${pathname}${search}${hash}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [name, params, drawing]);

  // Oben wird die Seite geteilt, unten die Kreation: Link mit Zeichnung,
  // ohne Sprachpfad – Empfänger landen in ihrer eigenen Sprache.
  const pageUrl = useCallback(() => `${window.location.origin}/`, []);
  const creationUrl = useCallback(
    () => `${window.location.origin}/${writeHash({ name, params, drawing })}`,
    [name, params, drawing]
  );
  const preview = useRef<PreviewHandle>(null);

  // „x Kreationen erstellt“: Downloads und geteilte Kreationen zählen auf dem
  // Server mit; dieselbe Kreation nur einmal pro Sitzung.
  const [creations, setCreations] = useState<number | null>(null);
  useEffect(() => {
    loadCreations().then(setCreations);
  }, []);
  const countThis = useCallback(() => {
    countCreation(writeHash({ name, params, drawing })).then((total) => {
      if (total !== null) setCreations(total);
    });
  }, [name, params, drawing]);

  const onDrawingChange = useCallback(
    (canvas: HTMLCanvasElement, next: Drawing) => {
      setDrawing(next);
      try {
        setRings(traceOutline(canvas));
        setInputError(undefined);
      } catch (cause) {
        setInputError(cause instanceof InputError ? cause.code : "read");
      }
    },
    []
  );

  const onImportError = useCallback((cause: unknown) => {
    console.error(cause);
    setInputError(cause instanceof InputError ? cause.code : "read");
  }, []);

  const onUserRotate = useCallback(() => setAutoRotate(false), []);

  // Layoutwechsel per View Transition animieren, wo der Browser es kann.
  const toggleExpanded = () => {
    const toggle = () => flushSync(() => setExpanded((on) => !on));
    if (document.startViewTransition) document.startViewTransition(toggle);
    else toggle();
  };

  const chooseUnit = useCallback((next: Unit) => {
    setUnit(next);
    storeUnit(next);
  }, []);

  const lang = i18n.resolvedLanguage ?? "en";

  return (
    <div className="app">
      <CookieBackground />
      <Masthead onUnitChange={chooseUnit} unit={unit} />

      <main className="layout" data-expanded={expanded || undefined}>
        <SettingsBar name={name} onNameChange={setName}>
          <SharePanel getUrl={pageUrl} name={name} />
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
          <DrawCanvas
            initialDrawing={shared.drawing}
            mmPerCanvas={mmPerCanvas}
            onChange={onDrawingChange}
            onError={onImportError}
            outline={outline}
            traceInitial={shared.rings.length === 0}
            unit={unit}
          />
          {error && (
            <p className="error" key={error} role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
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
                onClick={() => setAutoRotate((on) => !on)}
                title={t("preview.rotate")}
                type="button"
              >
                <CookieIcon icon={Rotate3d} roll={12} size={52} />
              </Button>
            </div>
          </div>

          <div className="stage viewer paper">
            <Preview3d
              autoRotate={autoRotate}
              mesh={mesh}
              onUserRotate={onUserRotate}
              ref={preview}
              shape={rings}
            />
            {!mesh && (
              <div className="stage-hint">
                <CookieIcon kind="star" size={120} spin={!ready} />
                <span>{ready ? t("preview.empty") : t("preview.loading")}</span>
              </div>
            )}
          </div>

          <ParameterPanel onChange={setParams} params={params} unit={unit} />

          <div className="export">
            <PrintHints />
            <ExportButtons
              mesh={mesh}
              name={name}
              onExport={countThis}
              size={params.size}
            >
              <ShareCreation
                disabled={!mesh}
                getUrl={creationUrl}
                name={name}
                onShare={countThis}
                preview={preview}
              />
            </ExportButtons>
          </div>
        </section>
      </main>

      <footer>
        <DonateBadge />
        <span className="footer-links">
          <a href={PORTFOLIO_URL} rel="noopener" target="_blank">
            mxwr.de
            <CookieIcon icon={ArrowUpRight} roll={-8} size={40} />
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
            <CookieIcon
              icing="#5fb36b"
              icon={ArrowUpRight}
              roll={10}
              size={40}
            />
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
