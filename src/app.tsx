import { ArrowUpRight, Rotate3d, Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import Button from "./components/button";
import CookieBackground from "./components/cookie-background";
import CookieIcon from "./components/cookie-icon";
import DrawCanvas from "./components/draw-canvas";
import ExportButtons from "./components/export-buttons";
import LegalNotice from "./components/legal-notice";
import ParameterPanel from "./components/parameter-panel";
import Preview3d from "./components/preview-3d";
import PrintHints from "./components/print-hints";
import Segmented from "./components/segmented";
import SettingsBar from "./components/settings-bar";
import SharePanel from "./components/share-panel";
import { InputError, type Ring, traceOutline } from "./geometry/outline";
import { useCutter } from "./geometry/use-cutter";
import { languages } from "./i18n";
import type { de } from "./i18n/de";
import {
  formatLength,
  initialUnit,
  storeUnit,
  type Unit,
  units,
} from "./units";
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
    // Ohne Form: Annahme, dass die Zeichnung etwa 70 % der Fläche füllt.
    const extent = Math.max(maxX - minX, maxY - minY);
    return params.size / (extent > 0 ? extent : 0.7);
  }, [outline, params.size]);

  // Ohne Form wird einfach die Seite geteilt, mit Form der Link samt Form.
  const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;

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
      <CookieBackground />
      <header className="masthead">
        <CookieIcon className="logo" kind="bite" roll={-18} size={100} />
        <div className="masthead-text">
          <h1>Cookie Cutter Maker</h1>
          <p>{t("tagline")}</p>
        </div>
        <div className="switches">
          <Segmented
            className="unit-switch"
            label={t("unit")}
            onChange={chooseUnit}
            options={units.map((option) => ({ value: option, label: option }))}
            value={unit}
          >
            <CookieIcon icing="#2a44ff" icon={Ruler} roll={35} size={44} />
          </Segmented>
          <Segmented
            label={t("language")}
            onChange={(lng) => i18n.changeLanguage(lng)}
            options={languages.map((lng) => ({
              value: lng,
              label: lng.toUpperCase(),
            }))}
            value={lang}
          />
        </div>
      </header>

      <main className="layout" data-expanded={expanded || undefined}>
        <SettingsBar name={name} onNameChange={setName}>
          <SharePanel name={name} url={shareUrl} />
        </SettingsBar>

        <section className="card shape-card">
          <div className="card-head">
            <h2>{t("steps.shape")}</h2>
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
            <h2>{t("steps.cutter")}</h2>
            {mesh && (
              <span className="dims">
                <CookieIcon icing="#2a44ff" icon={Ruler} roll={35} size={46} />
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
              <div className="stage-hint">
                <CookieIcon
                  kind={ready ? "star" : "chip"}
                  size={120}
                  spin={!ready}
                />
                <span>{ready ? t("preview.empty") : t("preview.loading")}</span>
              </div>
            )}
            <Button
              aria-label={t("preview.rotate")}
              aria-pressed={autoRotate}
              className="icon overlay"
              onClick={() => setAutoRotate((on) => !on)}
              title={t("preview.rotate")}
              type="button"
            >
              <Rotate3d aria-hidden size={18} />
            </Button>
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
