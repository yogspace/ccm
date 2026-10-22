import type { Ring } from "../geometry/outline";
import { bounds, contains } from "../geometry/rings";
import type { CookieShape } from "./shape-cookie";

/**
 * One cookie of a creation that bakes into several – shapes apart from each
 * other, or a cookie lying in another's hole: its outline with its holes and
 * the icing and embossing on it. `scale`: its longest side next to the
 * largest piece's (1 for that one).
 */
export type CookiePiece = { shape: CookieShape; scale: number };

/** Each piece's seed apart from the others – its own sprinkles. */
const SEED_STEP = 104729;

const longestSide = (ring: Ring) => {
  const { minX, minY, maxX, maxY } = bounds(ring);
  return Math.max(maxX - minX, maxY - minY);
};

/**
 * The cookies a creation bakes into, the largest first. One piece: the
 * shape as it is.
 */
export const cookiePieces = (shape: CookieShape): CookiePiece[] => {
  const { dough } = shape;
  // How many rings lie around each: even – an outline, odd – a hole.
  const depth = dough.map(
    (ring, i) =>
      dough.filter((other, j) => j !== i && contains(other, ring[0])).length
  );
  const outlines = dough.flatMap((_, i) => (depth[i] % 2 === 0 ? [i] : []));
  if (outlines.length <= 1) return [{ shape, scale: 1 }];

  /** The outline a ring lies in – the innermost around it, -1 for none. */
  const owner = (ring: Ring) => {
    let best = -1;
    for (const i of outlines) {
      if (!contains(dough[i], ring[0])) continue;
      if (best < 0 || depth[i] > depth[best]) best = i;
    }
    return best;
  };
  const largest = Math.max(...outlines.map((i) => longestSide(dough[i])));
  return outlines
    .map((i, k) => {
      const mine = (rings: Ring[] = []) =>
        rings.filter((ring) => owner(ring) === i);
      const holes = dough.filter(
        (ring, j) => depth[j] % 2 === 1 && owner(ring) === i
      );
      return {
        shape: {
          ...shape,
          dough: [dough[i], ...holes],
          icing: mine(shape.icing),
          imprint: mine(shape.imprint),
          inlay: mine(shape.inlay),
          seed: shape.seed + k * SEED_STEP,
        },
        scale: longestSide(dough[i]) / largest,
      };
    })
    .sort((a, b) => b.scale - a.scale);
};
