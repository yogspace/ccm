import {
  ArrowUpRight,
  Download,
  FileUp,
  Pencil,
  RotateCcw,
  Upload,
} from "lucide-react";
import type { ManifoldToplevel } from "manifold-3d";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import DrawPad from "./components/DrawPad";
import Preview from "./components/Preview";
import {
  buildCutter,
  type CutterMesh,
  type CutterParams,
  defaultParams,
} from "./geometry/cutter";
import { download, to3mf, toStl } from "./geometry/export";
import { loadManifold } from "./geometry/manifold";
import {
  loadImageFile,
  RES,
  type Ring,
  rasterize,
  traceOutline,
} from "./geometry/raster";

type Mode = "upload" | "draw";

const fields: {
  key: keyof CutterParams;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "size", label: "Größe", min: 20, max: 200, step: 1 },
  { key: "height", label: "Höhe", min: 5, max: 40, step: 0.5 },
  { key: "blade", label: "Schneide", min: 0.4, max: 3, step: 0.1 },
  { key: "flangeWidth", label: "Rand Breite", min: 0, max: 15, step: 0.5 },
  { key: "flangeHeight", label: "Rand Höhe", min: 0, max: 5, step: 0.1 },
  { key: "smoothing", label: "Lücken schließen", min: 0, max: 5, step: 0.1 },
];

const OutlinePreview = ({ rings }: { rings: Ring[] }) => (
  <svg className="outline" viewBox={`0 0 ${RES + 16} ${RES + 16}`}>
    <title>Erkannte Kontur</title>
    {rings.map((ring, i) => (
      <polygon
        key={i}
        points={ring.map(([x, y]) => `${x},${RES + 16 - y}`).join(" ")}
      />
    ))}
  </svg>
);

const App = () => {
  const [mode, setMode] = useState<Mode>("upload");
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [name, setName] = useState("ausstecher");
  const [params, setParams] = useState(defaultParams);
  const [wasm, setWasm] = useState<ManifoldToplevel>();
  const [cutter, setCutter] = useState<CutterMesh | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadManifold().then(setWasm, () =>
      setError("Geometrie-Engine konnte nicht geladen werden.")
    );
  }, []);

  const rings = useMemo(() => (source ? traceOutline(source) : []), [source]);

  useEffect(() => {
    if (!wasm) return;
    const timer = setTimeout(() => {
      try {
        setCutter(buildCutter(wasm, rings, params));
      } catch (cause) {
        console.error(cause);
        setError("Aus dieser Form ließ sich kein Ausstecher erzeugen.");
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [wasm, rings, params]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setSource(null);
    setError(undefined);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);
    try {
      setSource(await loadImageFile(file));
      setName(file.name.replace(/\.[^.]+$/, "") || "ausstecher");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Datei konnte nicht gelesen werden."
      );
    }
  };

  const onDraw = (canvas: HTMLCanvasElement | null) => {
    setName("ausstecher");
    setSource(canvas ? rasterize(canvas, RES, RES, 3) : null);
  };

  const setParam = (key: keyof CutterParams, value: number) =>
    setParams((current) => ({ ...current, [key]: value }));

  return (
    <main className="app">
      <header>
        <h1>Cookie Cutter Maker</h1>
        <p>
          SVG hochladen oder zeichnen – daraus wird ein druckfertiger
          Ausstecher.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <div className="tabs">
            <button
              aria-pressed={mode === "upload"}
              onClick={() => switchMode("upload")}
              type="button"
            >
              <Upload aria-hidden size={16} />
              Hochladen
            </button>
            <button
              aria-pressed={mode === "draw"}
              onClick={() => switchMode("draw")}
              type="button"
            >
              <Pencil aria-hidden size={16} />
              Zeichnen
            </button>
          </div>

          {mode === "upload" ? (
            <div className="upload">
              <label className="dropzone">
                <input
                  accept=".svg,image/svg+xml,image/png"
                  onChange={onFile}
                  type="file"
                />
                <FileUp aria-hidden size={24} />
                <span>SVG oder PNG auswählen</span>
              </label>
              {rings.length > 0 && <OutlinePreview rings={rings} />}
            </div>
          ) : (
            <DrawPad onChange={onDraw} />
          )}

          {error && <p className="error">{error}</p>}

          <fieldset className="params">
            <legend>Maße (mm)</legend>
            {fields.map(({ key, label, min, max, step }) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  max={max}
                  min={min}
                  onChange={(event) =>
                    setParam(key, Number(event.target.value))
                  }
                  step={step}
                  type="range"
                  value={params[key]}
                />
                <output>{params[key]}</output>
              </label>
            ))}
            <button onClick={() => setParams(defaultParams)} type="button">
              <RotateCcw aria-hidden size={16} />
              Zurücksetzen
            </button>
          </fieldset>
        </section>

        <section className="viewer">
          <Preview cutter={cutter} />
          {!cutter && (
            <p className="placeholder">
              {wasm ? "Noch keine Form." : "Lade Geometrie-Engine …"}
            </p>
          )}
          {cutter && (
            <div className="export">
              <span>
                {cutter.dimensions.map((d) => d.toFixed(1)).join(" × ")} mm
              </span>
              <button
                onClick={() => download(to3mf(cutter, name), `${name}.3mf`)}
                type="button"
              >
                <Download aria-hidden size={16} />
                3MF
              </button>
              <button
                onClick={() => download(toStl(cutter), `${name}.stl`)}
                type="button"
              >
                <Download aria-hidden size={16} />
                STL
              </button>
            </div>
          )}
        </section>
      </div>

      <footer>
        Ein Projekt von{" "}
        <a href="https://mxwr.de" rel="noopener" target="_blank">
          mxwr.de
          <ArrowUpRight aria-hidden size={14} />
        </a>
      </footer>
    </main>
  );
};

export default App;
