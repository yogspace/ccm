import { describe, expect, it } from "vitest";
import { arrange, boxOf, mergeMeshes, PLATE } from "../src/export/plate";
import type { MeshData } from "../src/geometry/mesh";

/** A w × d × h box standing at (x, y), its last two triangles embossing. */
const box = (w: number, d: number, h: number, x = 0, y = 0): MeshData => {
  const positions = new Float32Array(
    [
      [0, 0, 0],
      [w, 0, 0],
      [w, d, 0],
      [0, d, 0],
      [0, 0, h],
      [w, 0, h],
      [w, d, h],
      [0, d, h],
    ].flatMap(([px, py, pz]) => [px + x, py + y, pz])
  );
  const indices = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7]);
  return { positions, indices, dimensions: [w, d, h], embossFrom: 6 };
};

/** Whether two placed footprints keep apart. */
const apart = (
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number }
) =>
  Math.abs(a.x - b.x) >= (a.w + b.w) / 2 ||
  Math.abs(a.y - b.y) >= (a.d + b.d) / 2;

describe("arrange", () => {
  it("puts three cutters on one plate, apart and on it", () => {
    const sizes: [number, number][] = [
      [105, 86],
      [100, 92],
      [105, 92],
    ];
    const places = arrange(sizes);
    expect(places.every(({ plate }) => plate === 0)).toBe(true);
    const placed = places.map((place, i) => ({
      ...place,
      w: sizes[i][0],
      d: sizes[i][1],
    }));
    for (const { x, y, w, d } of placed) {
      expect(x - w / 2).toBeGreaterThanOrEqual(0);
      expect(x + w / 2).toBeLessThanOrEqual(PLATE);
      expect(y - d / 2).toBeGreaterThanOrEqual(0);
      expect(y + d / 2).toBeLessThanOrEqual(PLATE);
    }
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) expect(apart(a, b)).toBe(true);
    }
  });

  it("goes on to another plate when one is full", () => {
    const places = arrange(Array.from({ length: 6 }, () => [110, 110]));
    expect(places.map(({ plate }) => plate)).toEqual([0, 0, 0, 0, 1, 1]);
  });
});

describe("mergeMeshes", () => {
  it("moves each to its place, on the floor, the whole centered, the embossing last", () => {
    const merged = mergeMeshes(
      [box(10, 10, 5, 40, 40), box(20, 10, 8, -5, 3)],
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ]
    );
    const { min, max } = boxOf(merged);
    // Laid out from -5 to 40 across: shifted by half of that.
    expect(min).toEqual([-22.5, -5, 0]);
    expect(max).toEqual([22.5, 5, 8]);
    expect(merged.dimensions).toEqual([45, 10, 8]);
    expect(merged.indices.length).toBe(24);
    expect(merged.embossFrom).toBe(12);
    // The second box's embossing (its top) comes last.
    const last = [...merged.indices.slice(18)];
    expect(last.every((index) => index >= 8)).toBe(true);
  });
});
