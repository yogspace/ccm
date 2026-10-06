import { DRAW_RES, paint } from "../drawing";
import type { CutterRequest, CutterResponse } from "../geometry/cutter-worker";
import type { MeshData } from "../geometry/mesh";
import { type Ring, traceOutline } from "../geometry/outline";
import type { readHash } from "../url-state";

/**
 * Builds the cutter of a shared creation once: paints the drawing like the
 * drawing area does, traces it and lets the geometry worker do the rest –
 * the model, its contour and the icing of the cookie it bakes.
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
  return new Promise<{
    mesh: MeshData;
    outline: Ring[];
    icing: Ring[];
  } | null>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<CutterResponse>) => {
      if (data.type === "ready") return;
      worker.terminate();
      if (data.type !== "result") reject(new Error(data.type));
      else if (!data.mesh) resolve(null);
      else
        resolve({ mesh: data.mesh, outline: data.outline, icing: data.icing });
    };
    const request: CutterRequest = { id: 1, rings, params };
    worker.postMessage(request);
  });
};
