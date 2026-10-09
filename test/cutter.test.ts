import { readdirSync, readFileSync } from "node:fs";
import Module, { type Manifold, type ManifoldToplevel } from "manifold-3d";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCutter,
  type CutterParams,
  defaultParams,
  reliefReach,
} from "../src/geometry/cutter";
import type { Ring } from "../src/geometry/outline";
import { segmentDistance } from "../src/geometry/rings";
import { inspect } from "./clean";
import { blob, shapes, stroke } from "./shapes";

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
  const { rings, emboss, ...params } = JSON.parse(
    readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8")
  ) as { rings: Ring[]; emboss?: Ring[] } & Partial<CutterParams>;
  return { rings, emboss, params };
};

type Case = {
  name: string;
  rings: Ring[];
  /** Drawn in the embossing ink. */
  emboss?: Ring[];
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

const build = (
  rings: Ring[],
  overrides: Partial<CutterParams> = {},
  emboss: Ring[] = []
) => {
  const params = { ...defaultParams, ...overrides };
  const cutter = buildCutter(wasm, rings, params, emboss);
  if (!cutter) throw new Error("no cutter");
  return { cutter, params };
};

describe.each(cases)(
  "$name",
  ({ rings, emboss, params: overrides, maxArches }) => {
    it("is one clean, easy to clean part", () => {
      const { cutter, params } = build(rings, overrides, emboss);
      try {
        const inspection = inspect(wasm, cutter.manifold, params);
        expect(inspection.parts).toBe(1);
        // Nothing presses into the dough (but embossing), nothing covers an
        // opening.
        if (!emboss) expect(inspection.inDough).toBeLessThan(0.5);
        expect(inspection.overOpenings).toBeLessThan(0.5);
        // No hairline slits or sharp corners next to inner blades.
        expect(inspection.slits.filter(({ area }) => area > 0.3)).toEqual([]);
      } finally {
        cutter.manifold.delete();
      }
    });

    it.skipIf(!emboss)("embosses what is drawn in pink", () => {
      const { cutter, params } = build(rings, overrides, emboss);
      const plain = build(rings, overrides);
      // Halfway up the embossing: there is more than without it.
      const z = params.flangeHeight + reliefReach(params) / 2;
      const area = (solid: Manifold) => {
        const slice = solid.slice(z);
        const value = slice.area();
        slice.delete();
        return value;
      };
      try {
        expect(area(cutter.manifold)).toBeGreaterThan(
          area(plain.cutter.manifold) + 1
        );
      } finally {
        cutter.manifold.delete();
        plain.cutter.manifold.delete();
      }
    });

    it("holds the inner blades with as little as needed", () => {
      const { cutter, params } = build(rings, overrides, emboss);
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
  }
);

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

describe("embossing", () => {
  // A ring drawn in the embossing ink around the face, clear of the eyes
  // and the mouth – and a blot over an eye, which is an opening.
  const emboss = [...stroke(0.5, 0.5, 0.32, 0.02), ...blob(0.38, 0.4, 0.08)];

  const solid = (
    rings: Ring[],
    overrides: Partial<CutterParams>,
    drawn: Ring[] = []
  ) => {
    const params = { ...defaultParams, ...overrides };
    const cutter = buildCutter(wasm, rings, params, drawn);
    if (!cutter) throw new Error("no cutter");
    return { cutter, params };
  };

  /** Cross-section area of a cutter at height `z`. */
  const areaAt = (rings: Ring[], z: number, overrides = {}, drawn: Ring[]) => {
    const { cutter } = solid(rings, overrides, drawn);
    const slice = cutter.manifold.slice(z);
    const area = slice.area();
    slice.delete();
    cutter.manifold.delete();
    return area;
  };

  it("is one part over no opening, held like a hole", () => {
    const { cutter, params } = solid(shapes.face, {}, emboss);
    const plain = solid(shapes.face, {}, []);
    try {
      const inspection = inspect(wasm, cutter.manifold, params);
      expect(inspection.parts).toBe(1);
      expect(inspection.overOpenings).toBeLessThan(0.5);
      // The embossed ring needs holding of its own, like one more hole.
      expect(cutter.connections.length).toBeGreaterThan(
        plain.cutter.connections.length
      );
    } finally {
      cutter.manifold.delete();
      plain.cutter.manifold.delete();
    }
  });

  it("leaves the cookie open around it", () => {
    const { cutter } = solid(shapes.face, {}, emboss);
    // In the middle of the face, between the ring and the eyes: no plate.
    const plate = cutter.manifold.slice(0.15);
    const middle = wasm.CrossSection.square([2, 2], true);
    const covered = plate.intersect(middle);
    try {
      expect(covered.isEmpty()).toBe(true);
    } finally {
      for (const object of [covered, middle, plate]) object.delete();
      cutter.manifold.delete();
    }
  });

  it("reaches as far out of the flange as set, no further", () => {
    const { flangeHeight, relief } = defaultParams;
    const end = flangeHeight + relief;
    const plain = (z: number) => areaAt(shapes.face, z, {}, []);
    const embossed = (z: number) => areaAt(shapes.face, z, {}, emboss);
    // Just below its end the embossing is there, just above only the walls.
    expect(embossed(end - 0.2) - plain(end - 0.2)).toBeGreaterThan(20);
    expect(embossed(end + 0.2)).toBeCloseTo(plain(end + 0.2), 1);
  });

  it("reaches as high as the walls at most", () => {
    const top = defaultParams.flangeHeight + defaultParams.bladeHeight;
    const { cutter } = solid(shapes.face, { relief: 25 }, emboss);
    try {
      expect(cutter.manifold.boundingBox().max[2]).toBeCloseTo(top, 3);
    } finally {
      cutter.manifold.delete();
    }
    const high = { relief: 25 };
    expect(
      areaAt(shapes.face, top - 0.3, high, emboss) -
        areaAt(shapes.face, top - 0.3, high, [])
    ).toBeGreaterThan(20);
  });

  it("still holds cookie in an opening by its arch", () => {
    const { cutter, params } = solid(shapes["cookie in a hole"], {}, [
      ...stroke(0.5, 0.5, 0.36, 0.02),
    ]);
    try {
      expect(inspect(wasm, cutter.manifold, params).parts).toBe(1);
      expect(cutter.connections.length).toBeGreaterThan(0);
    } finally {
      cutter.manifold.delete();
    }
  });
});
