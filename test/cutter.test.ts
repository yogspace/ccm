import { readdirSync, readFileSync } from "node:fs";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCutter,
  type CutterParams,
  defaultParams,
} from "../src/geometry/cutter";
import type { Ring } from "../src/geometry/outline";
import { segmentDistance } from "../src/geometry/rings";
import { inspect } from "./clean";
import { shapes } from "./shapes";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

/**
 * Drawings saved from the app (“Test case” in the dev server): their contours
 * and the dimensions they had. Every one of them is checked.
 */
const drawn = readdirSync(new URL("fixtures/", import.meta.url))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

const fixture = (name: string) => {
  const { rings, ...params } = JSON.parse(
    readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8")
  ) as { rings: Ring[] } & Partial<CutterParams>;
  return { rings, params };
};

type Case = {
  name: string;
  rings: Ring[];
  params?: Partial<CutterParams>;
  /** At most this many arched bridges – no more than needed. */
  maxArches?: number;
};

/** Short gaps are linked flat – no arches at all. */
const flatOnly = new Set(["star with a star hole", "slot along the wall"]);

/** What some drawings must come out as, beyond being clean. */
const expected: Record<string, Pick<Case, "maxArches">> = {
  // Eyes and mouth linked flat, hung from two arches.
  poop: { maxArches: 2 },
  // Eyes, nose and teeth close together: linked flat into one piece, held
  // flat at the jaw and the cheek, by one arch on the far side.
  skull: { maxArches: 1 },
};

const cases: Case[] = [
  ...Object.entries(shapes).map(([name, rings]) => ({
    name,
    rings,
    maxArches: flatOnly.has(name) ? 0 : undefined,
  })),
  ...drawn.map((name) => ({
    name: `${name} (drawn)`,
    ...fixture(name),
    ...expected[name],
  })),
  {
    name: "poop, wide bridges",
    ...fixture("poop"),
    params: { ...fixture("poop").params, bridgeWidth: 6 },
  },
  {
    name: "poop, thin wall",
    ...fixture("poop"),
    params: { ...fixture("poop").params, wall: 0.8 },
  },
];

const build = (rings: Ring[], overrides: Partial<CutterParams> = {}) => {
  const params = { ...defaultParams, ...overrides };
  const cutter = buildCutter(wasm, rings, params);
  if (!cutter) throw new Error("no cutter");
  return { cutter, params };
};

describe.each(cases)("$name", ({ rings, params: overrides, maxArches }) => {
  it("is one clean, easy to clean part", () => {
    const { cutter, params } = build(rings, overrides);
    try {
      const inspection = inspect(wasm, cutter.manifold, params);
      expect(inspection.parts).toBe(1);
      // Nothing presses into the dough, nothing covers an opening.
      expect(inspection.inDough).toBeLessThan(0.5);
      expect(inspection.overOpenings).toBeLessThan(0.5);
      // No hairline slits or sharp corners next to inner blades.
      expect(inspection.slits.filter(({ area }) => area > 0.3)).toEqual([]);
    } finally {
      cutter.manifold.delete();
    }
  });

  it("holds the inner blades with as little as needed", () => {
    const { cutter, params } = build(rings, overrides);
    cutter.manifold.delete();
    const arches = cutter.connections.filter(({ kind }) => kind === "arch");
    if (maxArches !== undefined) {
      expect(arches.length).toBeLessThanOrEqual(maxArches);
    }
    // Arches keep their distance, or they merge into a block.
    const gap = 6 + 2 * params.bridgeWidth;
    for (const [i, a] of arches.entries()) {
      for (const b of arches.slice(i + 1)) {
        const apart = segmentDistance(a.from, a.to, b.from, b.to);
        if (a.start !== b.start) expect(apart).toBeGreaterThanOrEqual(gap);
      }
    }
  });
});

describe("parameters", () => {
  it("leaves out holes without cutouts", () => {
    const { cutter } = build(shapes.face, { cutouts: 0 });
    expect(cutter.connections).toEqual([]);
    cutter.manifold.delete();
  });

  it("mirrors the cutter for text", () => {
    const rings = fixture("poop").rings;
    const center = (mirror: number) => {
      const { cutter } = build(rings, { mirror });
      const { min, max } = cutter.manifold.boundingBox();
      const volume = cutter.manifold.volume();
      cutter.manifold.delete();
      return { x: (min[0] + max[0]) / 2, volume };
    };
    const plain = center(0);
    const mirrored = center(1);
    expect(mirrored.x).toBeCloseTo(-plain.x, 3);
    expect(mirrored.volume).toBeCloseTo(plain.volume, 0);
  });
});
