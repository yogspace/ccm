/// <reference lib="webworker" />
import { buildCutter, type CutterParams } from "./cutter";
import { loadManifold } from "./manifold";
import { type MeshData, toMeshData } from "./mesh";
import type { Ring } from "./outline";

export type CutterRequest = { id: number; rings: Ring[]; params: CutterParams };

export type CutterResponse =
  | { type: "ready" }
  | { type: "engine-error" }
  | {
      type: "result";
      id: number;
      mesh: MeshData | null;
      outline: Ring[];
      icing: Ring[];
    }
  | { type: "build-error"; id: number };

declare const self: DedicatedWorkerGlobalScope;

const post = (message: CutterResponse, transfer: Transferable[] = []) =>
  self.postMessage(message, transfer);

const wasm = loadManifold();
wasm.then(
  () => post({ type: "ready" }),
  () => post({ type: "engine-error" })
);

// Only the latest job counts: whatever arrives during a computation replaces
// each other instead of piling up.
let next: CutterRequest | null = null;
let scheduled = false;

const run = async () => {
  scheduled = false;
  const job = next;
  next = null;
  if (!job) return;
  try {
    const cutter = buildCutter(await wasm, job.rings, job.params);
    if (!cutter) {
      post({ type: "result", id: job.id, mesh: null, outline: [], icing: [] });
      return;
    }
    const mesh = toMeshData(cutter.manifold);
    cutter.manifold.delete();
    const { outline, icing } = cutter;
    post({ type: "result", id: job.id, mesh, outline, icing }, [
      mesh.positions.buffer,
      mesh.indices.buffer,
    ]);
  } catch (error) {
    console.error(error);
    post({ type: "build-error", id: job.id });
  }
};

self.onmessage = (event: MessageEvent<CutterRequest>) => {
  next = event.data;
  if (!scheduled) {
    scheduled = true;
    setTimeout(run, 0);
  }
};
