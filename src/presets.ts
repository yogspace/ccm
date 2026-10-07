/**
 * Templates next to the drawing area – uploaded in the admin (collection
 * “Templates”, see content.ts) with their names. Whether a shape is filled or
 * drawn as a line does not matter: its outline is inserted.
 */
import type { Preset } from "./assets";
import { loadSilhouette, type Ring, traceOutline } from "./geometry/outline";
import { simplifyLine } from "./url-state";

export type { Preset };

/** Contours (normalised to 0…1, aspect ratio kept) and an SVG path on a 24 grid for the card. */
export type PresetShape = { rings: Ring[]; path: string };

const SIZE = 512;
const cache = new Map<string, Promise<PresetShape>>();

/** Reads a template's outlines – whether it is filled or drawn as a line. */
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
      // Fit into a square so nothing gets distorted.
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
