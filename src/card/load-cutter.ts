import { DRAW_RES, paint } from "../drawing";
import type { CutterRequest, CutterResponse } from "../geometry/cutter-worker";
import type { MeshData } from "../geometry/mesh";
import { traceOutline } from "../geometry/outline";
import type { readHash } from "../url-state";

/**
 * Builds the cutter of a shared creation once: paints the drawing like the
 * drawing area does, traces it and lets the geometry worker do the rest.
 */
export const loadCutter = async ({
  drawing,
  rings: shared,
  params,
}: ReturnType<typeof readHash>) => {
  let rings = shared;
  // New links bring the drawing, old ones the contour itself.
  if (rings.length === 0) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = DRAW_RES;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No canvas");
    paint(ctx, drawing);
    rings = traceOutline(canvas);
  }
  const worker = new Worker(
    new URL("../geometry/cutter-worker.ts", import.meta.url),
    { type: "module" }
  );
  return new Promise<MeshData | null>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<CutterResponse>) => {
      if (data.type === "ready") return;
      worker.terminate();
      if (data.type === "result") resolve(data.mesh);
      else reject(new Error(data.type));
    };
    const request: CutterRequest = { id: 1, rings, params };
    worker.postMessage(request);
  });
};
