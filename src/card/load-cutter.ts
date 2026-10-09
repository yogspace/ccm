import { traceInks } from "../drawing";
import type { CutterParams } from "../geometry/cutter";
import type { CutterRequest, CutterResponse } from "../geometry/cutter-worker";
import type { MeshData } from "../geometry/mesh";
import type { Ring } from "../geometry/outline";
import type { readHash } from "../url-state";

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

const build = (rings: Ring[], emboss: Ring[], params: CutterParams) => {
  const worker = new Worker(
    new URL("../geometry/cutter-worker.ts", import.meta.url),
    { type: "module" }
  );
  return new Promise<{
    mesh: MeshData;
    outline: Ring[];
    icing: Ring[];
    imprint: Ring[];
    inlay: Ring[];
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
        const { mesh, outline, icing, imprint, inlay } = data;
        resolve({ mesh, outline, icing, imprint, inlay });
      }
    };
    // The worker itself did not load.
    worker.onerror = (event) => {
      clearTimeout(silent);
      worker.terminate();
      reject(new Error(`worker: ${event.message}`));
    };
    const request: CutterRequest = { id: 1, rings, emboss, params };
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
      // Old links bring the contour itself; new ones the drawing – traced
      // like the drawing area does it, each ink on its own.
      const { rings, emboss } =
        shared.length > 0 ? { rings: shared, emboss: [] } : traceInks(drawing);
      return await build(rings, emboss, params);
    } catch (error) {
      if (attempt >= RETRIES.length) throw error;
      console.warn("Shaping the cutter failed, trying again", error);
      await wait(RETRIES[attempt]);
    }
  }
};
