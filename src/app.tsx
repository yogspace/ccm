import { ArrowUpRight, Cookie, Rotate3d, Ruler } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import DrawCanvas from "./components/draw-canvas";
import ExportButtons from "./components/export-buttons";
import LegalNotice from "./components/legal-notice";
import ParameterPanel from "./components/parameter-panel";
import Preview3d from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import ShareButton from "./components/share-button";
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
  useEffect(() => {
    const timer = setTimeout(() => {
      const { pathname, search } = window.location;
      window.history.replaceState(
        null,
        "",
        `${pathname}${search}${writeHash({ name, params, rings: outline })}`
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [name, params, outline]);

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
            onChange={onDrawingChange}
            onError={onImportError}
            onToggleExpanded={toggleExpanded}
            outline={outline}
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

          <ParameterPanel
            onChange={setParams}
            onUnitChange={chooseUnit}
            params={params}
            unit={unit}
          />

          <div className="export">
            <label className="name-field">
              <span>{t("export.name")}</span>
              <input
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("export.namePlaceholder")}
                type="text"
                value={name}
              />
            </label>
            <PrintHints />
            <div className="toolbar">
              <ShareButton disabled={rings.length === 0} name={name} />
              <ExportButtons mesh={mesh} name={name} size={params.size} />
            </div>
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
