import { ArrowUpRight, Cookie, Rotate3d, Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import DrawCanvas from "./components/draw-canvas";
import ExportButtons from "./components/export-buttons";
import LegalNotice from "./components/legal-notice";
import ParameterPanel from "./components/parameter-panel";
import Preview3d from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import SettingsBar from "./components/settings-bar";
import SharePanel from "./components/share-panel";
import { InputError, type Ring, traceOutline } from "./geometry/outline";
import { useCutter } from "./geometry/use-cutter";
import { languages } from "./i18n";
import type { de } from "./i18n/de";
import { formatLength, initialUnit, storeUnit, type Unit } from "./units";
import { readHash, writeHash } from "./url-state";

type ErrorKey = keyof (typeof de)["errors"];

/** Zustand aus einem geteilten Link – einmal beim Laden gelesen. */
const shared = readHash(window.location.hash);

const App = () => {
  const { t, i18n } = useTranslation();
  const [rings, setRings] = useState<Ring[]>(shared.rings);
  const [params, setParams] = useState(shared.params);
  const [name, setName] = useState(shared.name);
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [autoRotate, setAutoRotate] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [inputError, setInputError] = useState<ErrorKey>();
  const { ready, mesh, outline, error: cutterError } = useCutter(rings, params);
  const error = inputError ?? cutterError;

  // Zustand laufend in den Link schreiben, damit er sich jederzeit teilen lässt.
  // Gespeichert wird die fertige Kontur – kompakter als die Rohzeichnung.
  const hash = useMemo(
    () => writeHash({ name, params, rings: outline }),
    [name, params, outline]
  );
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
    const extent = Math.max(maxX - minX, maxY - minY);
    return extent > 0 ? params.size / extent : null;
  }, [outline, params.size]);

  const shareUrl =
    outline.length > 0
      ? `${window.location.origin}${window.location.pathname}${hash}`
      : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      const { pathname, search } = window.location;
      window.history.replaceState(null, "", `${pathname}${search}${hash}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [hash]);

  const onDrawingChange = useCallback((canvas: HTMLCanvasElement) => {
    try {
      setRings(traceOutline(canvas));
      setInputError(undefined);
    } catch (cause) {
      setInputError(cause instanceof InputError ? cause.code : "read");
    }
  }, []);

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

  const chooseUnit = (next: Unit) => {
    setUnit(next);
    storeUnit(next);
  };

  const lang = i18n.resolvedLanguage ?? "en";

  return (
    <div className="app">
      <header className="masthead">
        <Cookie aria-hidden className="logo" size={28} strokeWidth={1.75} />
        <div className="masthead-text">
          <h1>Cookie Cutter Maker</h1>
          <p>{t("tagline")}</p>
        </div>
        <div className="switches">
          <fieldset aria-label={t("language")} className="switch">
            {languages.map((lng) => (
              <button
                aria-pressed={lang === lng}
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                type="button"
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </fieldset>
        </div>
      </header>

      <main className="layout" data-expanded={expanded || undefined}>
        <SettingsBar
          name={name}
          onNameChange={setName}
          onUnitChange={chooseUnit}
          unit={unit}
        >
          <SharePanel name={name} url={shareUrl} />
        </SettingsBar>

        <section className="card shape-card">
          <div className="card-head">
            <h2>
              <span className="step">1</span>
              {t("steps.shape")}
            </h2>
          </div>
          <DrawCanvas
            expanded={expanded}
            initialRings={shared.rings}
            mmPerCanvas={mmPerCanvas}
            onChange={onDrawingChange}
            onError={onImportError}
            onToggleExpanded={toggleExpanded}
            outline={outline}
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
            <h2>
              <span className="step">2</span>
              {t("steps.cutter")}
            </h2>
            {mesh && (
              <span className="dims">
                <Ruler aria-hidden size={16} />
                {mesh.dimensions
                  .map((d) =>
                    formatLength(d, unit, lang, unit === "in" ? 2 : 0)
                  )
                  .join(" × ")}
              </span>
            )}
          </div>

          <div className="stage viewer">
            <Preview3d
              autoRotate={autoRotate}
              mesh={mesh}
              onUserRotate={onUserRotate}
              shape={rings}
            />
            {!mesh && (
              <p className="stage-hint">
                {ready ? t("preview.empty") : t("preview.loading")}
              </p>
            )}
            <button
              aria-label={t("preview.rotate")}
              aria-pressed={autoRotate}
              className="icon overlay"
              onClick={() => setAutoRotate((on) => !on)}
              title={t("preview.rotate")}
              type="button"
            >
              <Rotate3d aria-hidden size={18} />
            </button>
          </div>

          <ParameterPanel onChange={setParams} params={params} unit={unit} />

          <div className="export">
            <PrintHints />
            <ExportButtons mesh={mesh} name={name} size={params.size} />
          </div>
        </section>
      </main>

      <footer>
        <span className="credit">
          © {new Date().getFullYear()} Maximilian Weber ·{" "}
          <a href="https://mxwr.de" rel="noopener" target="_blank">
            mxwr.de
            <ArrowUpRight aria-hidden size={14} />
          </a>
        </span>
        <LegalNotice />
      </footer>
    </div>
  );
};

export default App;
