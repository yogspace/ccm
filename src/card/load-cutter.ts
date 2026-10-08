import { DRAW_RES, paint } from "../drawing";
import type { CutterParams } from "../geometry/cutter";
import type { CutterRequest, CutterResponse } from "../geometry/cutter-worker";
import type { MeshData } from "../geometry/mesh";
import { type Ring, traceOutline } from "../geometry/outline";
import type { Drawing, readHash } from "../url-state";

/** Pauses (ms) before trying again – time for Safari to free canvas memory. */
const RETRIES = [600, 1500];

/**
 * A worker that has not started after this long (ms) counts as failed –
 * never an endless wait. Once started it may take as long as it needs: a
 * page without a secure context (http in the LAN) runs WebAssembly much
 * slower in Safari.
 */
const SILENCE = 20_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** New links bring the drawing – traced like the drawing area does it. */
const trace = (drawing: Drawing) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DRAW_RES;
  const ctx = canvas.getContext("2d");
  try {
    if (!ctx) throw new Error("No canvas");
    paint(ctx, drawing);
    return traceOutline(canvas);
  } finally {
    // Freed right away: iOS Safari's canvas memory is tight and freed late.
    canvas.width = canvas.height = 0;
  }
};

const build = (rings: Ring[], params: CutterParams) => {
  const worker = new Worker(
    new URL("../geometry/cutter-worker.ts", import.meta.url),
    { type: "module" }
  );
  return new Promise<{
    mesh: MeshData;
    outline: Ring[];
    icing: Ring[];
  } | null>((resolve, reject) => {
    const silent = setTimeout(() => {
      worker.terminate();
      reject(new Error("worker: did not start"));
    }, SILENCE);
    worker.onmessage = ({ data }: MessageEvent<CutterResponse>) => {
      clearTimeout(silent);
      if (data.type === "ready") return;
      worker.terminate();
      if (data.type !== "result") reject(new Error(data.type));
      else if (!data.mesh) resolve(null);
      else {
        resolve({ mesh: data.mesh, outline: data.outline, icing: data.icing });
      }
    };
    // The worker itself did not load.
    worker.onerror = (event) => {
      clearTimeout(silent);
      worker.terminate();
      reject(new Error(`worker: ${event.message}`));
    };
    const request: CutterRequest = { id: 1, rings, params };
    worker.postMessage(request);
  });
};

/**
 * Builds the cutter of a shared creation once: paints the drawing like the
 * drawing area does, traces it and lets the geometry worker do the rest –
 * the model, its contour and the icing of the cookie it bakes. A failure is
 * tried again after a pause or two.
 */
export const loadCutter = async ({
  drawing,
  rings: shared,
  params,
}: ReturnType<typeof readHash>) => {
  for (let attempt = 0; ; attempt++) {
    try {
      // Old links bring the contour itself.
      const rings = shared.length > 0 ? shared : trace(drawing);
      return await build(rings, params);
    } catch (error) {
      if (attempt >= RETRIES.length) throw error;
      console.warn("Shaping the cutter failed, trying again", error);
      await wait(RETRIES[attempt]);
    }
  }
};
