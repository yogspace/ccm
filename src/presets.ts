import { loadSilhouette, type Ring, traceOutline } from "./geometry/outline";
import { simplifyLine } from "./url-state";

/**
 * Vorlagen unter der Zeichenfläche: Jede SVG-Datei in src/presets/ wird
 * automatisch eine. Die Reihenfolge folgt dem Dateinamen; eine führende Zahl
 * („1-star.svg“) sortiert nur und gehört nicht zum Namen. Den angezeigten
 * Namen gibt es unter `presets.<name>` in den Übersetzungen, sonst den
 * Dateinamen.
 */
const files = import.meta.glob<string>("./presets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export type Preset = { id: string; markup: string };

export const presets: Preset[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
  .map(([path, markup]) => ({
    id: (path.split("/").pop() ?? path)
      .replace(/\.svg$/i, "")
      .replace(/^\d+[-_ ]*/, ""),
    markup,
  }));

/** Lesbarer Name aus dem Dateinamen, falls es keine Übersetzung gibt. */
export const fallbackName = (id: string) =>
  id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Konturen (normiert 0…1, Seitenverhältnis erhalten) und ein SVG-Pfad im 24er-Raster für den Keks. */
export type PresetShape = { rings: Ring[]; path: string };

const SIZE = 512;
const cache = new Map<string, Promise<PresetShape>>();

/** Liest die Umrisse einer Vorlage – egal ob gefüllt oder als Linie gezeichnet. */
export const loadPreset = (preset: Preset) => {
  let pending = cache.get(preset.id);
  if (!pending) {
    pending = (async () => {
      const silhouette = await loadSilhouette(
        new File([preset.markup], `${preset.id}.svg`, {
          type: "image/svg+xml",
        }),
        SIZE
      );
      // Quadratisch einpassen, damit nichts verzerrt.
      const square = document.createElement("canvas");
      square.width = square.height = SIZE;
      const ctx = square.getContext("2d");
      if (ctx) {
        const scale = SIZE / Math.max(silhouette.width, silhouette.height);
        const w = silhouette.width * scale;
        const h = silhouette.height * scale;
        ctx.drawImage(silhouette, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      }
      const rings = traceOutline(square)
        .map((ring) => simplifyLine(ring, 0.0015))
        .filter((ring) => ring.length >= 4);
      const path = rings
        .map(
          (ring) =>
            `M${ring.map(([x, y]) => `${(2.5 + x * 19).toFixed(2)} ${(2.5 + y * 19).toFixed(2)}`).join("L")}Z`
        )
        .join("");
      return { rings, path };
    })();
    cache.set(preset.id, pending);
  }
  return pending;
};
