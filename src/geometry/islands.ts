import type { Ring } from "./outline";
import { contains, signedArea } from "./rings";

/** One closed outer contour of the cookie shape and where it lies. */
export type Island = {
  ring: Ring;
  area: number;
  /** The island this one lies inside, if any. */
  parent: Island | null;
  /** 0 = outside, 1 = hole in it, 2 = cookie in the hole … */
  depth: number;
  /**
   * Embossing (cutter.ts): held like a hole, but only by flat links in the
   * flange plate – it cuts nothing, so no arch is needed over its span.
   */
  relief?: boolean;
};

/** A hole in the cookie (odd depth) – as opposed to cookie (even depth). */
export const isHole = (island: Island) => island.depth % 2 === 1;

/** Orders the islands' outer contours: which lies inside which? */
export const nestIslands = (exteriors: Ring[]): Island[] => {
  const islands: Island[] = exteriors.map((ring) => ({
    ring,
    area: signedArea(ring),
    parent: null,
    depth: 0,
  }));
  for (const island of islands) {
    let smallest = Infinity;
    for (const other of islands) {
      if (
        other === island ||
        other.area <= island.area ||
        other.area >= smallest
      ) {
        continue;
      }
      // Outer contours never cross – one point is enough.
      if (contains(other.ring, island.ring[0])) {
        smallest = other.area;
        island.parent = other;
      }
    }
  }
  const depthOf = (island: Island): number =>
    island.parent ? depthOf(island.parent) + 1 : 0;
  for (const island of islands) island.depth = depthOf(island);
  return islands;
};
