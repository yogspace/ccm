import { useEffect, useState } from "react";
import { hasShape, shared } from "./card-link";
import { loadCutter } from "./load-cutter";

/**
 * The card's cutter, shaped from its link (load-cutter.ts) – tried again on
 * `retry`. Once it is there:
 * - `waitShown`: “Shaping your cutter” stays a moment, fading out while the
 *   cutter grows up out of the card;
 * - `baked`: the cookies (on the back, raining down) are baked a little
 *   later – baking them at once would make the cutter's entrance stutter –
 *   or right away (`bake`, the card turned early).
 */
export const useCutter = () => {
  const [cutter, setCutter] =
    useState<Awaited<ReturnType<typeof loadCutter>>>(null);
  const [failed, setFailed] = useState(!hasShape);
  /** Counts the tries – “Try again” starts another. */
  const [attempt, setAttempt] = useState(0);
  const [waitShown, setWaitShown] = useState(true);
  const [baked, setBaked] = useState(false);
  const mesh = cutter?.mesh ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: every try shapes it anew
  useEffect(() => {
    if (!hasShape) return;
    let current = true;
    setFailed(false);
    loadCutter(shared).then(
      (result) => {
        if (!current) return;
        setCutter(result);
        setFailed(!result);
      },
      (error: unknown) => {
        console.error("The cutter could not be shaped", error);
        if (current) setFailed(true);
      }
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!mesh) {
      setWaitShown(true);
      setBaked(false);
      return;
    }
    const timers = [
      setTimeout(() => setWaitShown(false), 500),
      setTimeout(() => setBaked(true), 1300),
    ];
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [mesh]);

  return {
    cutter,
    mesh,
    failed,
    retry: () => setAttempt((count) => count + 1),
    waitShown,
    baked,
    bake: () => setBaked(true),
  };
};
