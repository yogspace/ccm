import { useEffect, useRef, useState } from "react";
import type { CutterParams } from "./cutter";
import type { CutterRequest, CutterResponse } from "./cutter-worker";
import type { MeshData } from "./mesh";
import type { Ring } from "./outline";

type State = {
  ready: boolean;
  mesh: MeshData | null;
  outline: Ring[];
  error?: "engine" | "build";
};

/**
 * Rechnet den Ausstecher in einem Web Worker, damit Zeichnen und Regler
 * flüssig bleiben. Antworten auf veraltete Aufträge werden verworfen.
 */
export const useCutter = (rings: Ring[], params: CutterParams) => {
  const workerRef = useRef<Worker>(null);
  const latest = useRef(0);
  const [state, setState] = useState<State>({
    ready: false,
    mesh: null,
    outline: [],
  });

  useEffect(() => {
    const worker = new Worker(new URL("./cutter-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }: MessageEvent<CutterResponse>) => {
      if (data.type === "ready") {
        setState((current) => ({ ...current, ready: true }));
      } else if (data.type === "engine-error") {
        setState((current) => ({ ...current, error: "engine" }));
      } else if (data.id === latest.current) {
        setState((current) =>
          data.type === "result"
            ? {
                ready: true,
                mesh: data.mesh,
                outline: data.outline,
              }
            : { ...current, error: "build" }
        );
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    const id = ++latest.current;
    const request: CutterRequest = { id, rings, params };
    workerRef.current?.postMessage(request);
  }, [rings, params]);

  return state;
};
