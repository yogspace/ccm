import Module, { type ManifoldToplevel } from "manifold-3d";

let instance: Promise<ManifoldToplevel> | undefined;

/** The WebAssembly lies in public/ (copied by scripts/prepare.mjs). */
const WASM_URL = "/manifold.wasm";

export const loadManifold = () => {
  instance ??= Module({ locateFile: () => WASM_URL }).then((wasm) => {
    wasm.setup();
    return wasm;
  });
  return instance;
};
