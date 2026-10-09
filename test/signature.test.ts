import Module, {
  type CrossSection,
  type Manifold,
  type ManifoldToplevel,
} from "manifold-3d";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Ring } from "../src/geometry/outline";
import { SIGNATURE_HEIGHT, signatureArea } from "../src/geometry/signature";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const garbage: (CrossSection | Manifold)[] = [];
const track = <T extends CrossSection | Manifold>(object: T) => {
  garbage.push(object);
  return object;
};
afterEach(() => {
  for (const object of garbage.splice(0)) object.delete();
});

describe("the maker's mark", () => {
  it("spells MXWR along a straight flange, letter beside letter", () => {
    // A long flange, counter-clockwise; its bottom runs to the right.
    const middle: Ring = [
      [0, 0],
      [80, 0],
      [80, 40],
      [0, 40],
    ];
    const room = track(wasm.CrossSection.square([200, 200], true));
    const mark = signatureArea({ wasm, track }, middle, room);
    expect(mark).not.toBeNull();
    if (!mark) return;
    // Four letters, none on top of another.
    expect(mark.decompose().map(track).length).toBe(4);
    const { min, max } = mark.bounds();
    // About twelve millimetres long, one letter high – lying along the
    // bottom, upright.
    expect(max[0] - min[0]).toBeGreaterThan(10);
    expect(max[0] - min[0]).toBeLessThan(14);
    expect(max[1] - min[1]).toBeLessThan(SIGNATURE_HEIGHT + 1);
    expect(Math.abs((min[1] + max[1]) / 2)).toBeLessThan(0.5);
  });
});
