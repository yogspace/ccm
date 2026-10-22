import { describe, expect, it } from "vitest";
import { cookiePieces } from "../src/cookies/pieces";
import type { CookieShape } from "../src/cookies/shape-cookie";
import type { Ring } from "../src/geometry/outline";
import { blob } from "./shapes";

/** A creation's cookie: the dough as given, the icing a little smaller. */
const cookie = (dough: Ring[], icing: Ring[] = []): CookieShape => ({
  dough,
  icing,
  seed: 7,
});

describe("cookiePieces", () => {
  it("leaves a cookie in one piece as it is", () => {
    const shape = cookie(blob(0.5, 0.5, 0.4), blob(0.5, 0.5, 0.36));
    expect(cookiePieces(shape)).toEqual([{ shape, scale: 1 }]);
  });

  it("keeps a hole with the cookie it is in", () => {
    const shape = cookie([...blob(0.5, 0.5, 0.4), ...blob(0.5, 0.5, 0.15)]);
    expect(cookiePieces(shape)).toHaveLength(1);
  });

  it("parts cookies apart from each other, the largest first", () => {
    const small = blob(0.8, 0.5, 0.1);
    const large = blob(0.3, 0.5, 0.2);
    const pieces = cookiePieces(
      cookie([...small, ...large], [...blob(0.8, 0.5, 0.08)])
    );
    expect(pieces[0].scale).toBe(1);
    expect(pieces[1].scale).toBeCloseTo(0.5);
    expect(pieces[0].shape.dough).toEqual(large);
    expect(pieces[0].shape.icing).toEqual([]);
    expect(pieces[1].shape.dough).toEqual(small);
    expect(pieces[1].shape.icing).toHaveLength(1);
    expect(pieces[0].shape.seed).not.toBe(pieces[1].shape.seed);
  });

  it("parts a cookie lying in another's hole from it", () => {
    const outer = blob(0.5, 0.5, 0.45);
    const hole = blob(0.5, 0.5, 0.3);
    const inner = blob(0.5, 0.5, 0.15);
    const pieces = cookiePieces(
      cookie(
        [...outer, ...hole, ...inner],
        [
          ...blob(0.5, 0.5, 0.42),
          ...blob(0.5, 0.5, 0.33),
          ...blob(0.5, 0.5, 0.12),
        ]
      )
    );
    expect(pieces).toHaveLength(2);
    expect(pieces[0].shape.dough).toEqual([...outer, ...hole]);
    expect(pieces[0].shape.icing).toHaveLength(2);
    expect(pieces[1].shape.dough).toEqual(inner);
    expect(pieces[1].shape.icing).toHaveLength(1);
  });
});
