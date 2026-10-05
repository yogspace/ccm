import Module, { type ManifoldToplevel } from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";

let instance: Promise<ManifoldToplevel> | undefined;

export const loadManifold = () => {
  instance ??= Module({ locateFile: () => wasmUrl }).then((wasm) => {
    wasm.setup();
    return wasm;
  });
  return instance;
};
