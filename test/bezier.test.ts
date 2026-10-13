import { inflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  ANCHOR,
  anchorCount,
  anchorGuides,
  curvesOf,
  flatten,
  insertAnchor,
  isSmooth,
  lineStroke,
  moveAnchor,
  moveHandle,
  pathGrip,
  pointOn,
  pullHandles,
  removeAnchor,
  snap45,
  snapPoint,
  toggleSmooth,
} from "../src/bezier";
import { applyEraser, transformDrawing } from "../src/drawing";
import type { Point } from "../src/geometry/outline";
import { defaultParams } from "../src/geometry/cutter";
import {
  type Drawing,
  readHash,
  type Stroke,
  writeHash,
} from "../src/url-state";

/** An anchor without handles – a corner. */
const corner = (x: number, y: number) => [x, y, x, y, x, y];
/** A smooth anchor: its handle out at (ox, oy), in mirrored. */
const smooth = (x: number, y: number, ox: number, oy: number) => [
  x,
  y,
  2 * x - ox,
  2 * y - oy,
  ox,
  oy,
];

/** How far a point lies from a polyline. */
const off = ([x, y]: Point, points: readonly Point[]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
      : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};

const share = (strokes: Stroke[]) =>
  writeHash({
    name: "",
    params: defaultParams,
    drawing: { base: [], baseLine: 0, strokes },
  });

/** The format version a link was written in (its first varint, ZigZag). */
const versionOf = (hash: string) => {
  const s = new URLSearchParams(hash.slice(1)).get("s") ?? "";
  const bytes = inflateSync(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0)
    )
  );
  return bytes[0] / 2;
};

describe("an anchored line made flat", () => {
  it("keeps a straight line straight – its ends exactly", () => {
    const points = flatten([...corner(100, 200), ...corner(700, 200)]);
    expect(points[0]).toEqual([100, 200]);
    expect(points.at(-1)).toEqual([700, 200]);
    expect(points.every(([, y]) => y === 200)).toBe(true);
  });

  it("follows a curve within half a pixel", () => {
    const a = [...smooth(100, 500, 300, 100), ...smooth(800, 500, 900, 900)];
    const points = flatten(a);
    for (const curve of curvesOf(a, false)) {
      for (let t = 0; t <= 1; t += 0.01) {
        expect(off(pointOn(curve, t), points)).toBeLessThan(0.6);
      }
    }
  });

  it("runs a closed line back to its start", () => {
    const a = [...corner(100, 100), ...corner(500, 100), ...corner(300, 400)];
    const points = flatten(a, true);
    expect(points.at(-1)).toEqual([100, 100]);
    expect(off([200, 250], points)).toBeLessThan(1);
  });

  it("makes a dot of one anchor, nothing of none", () => {
    expect(flatten(corner(10, 20))).toEqual([[10, 20]]);
    expect(flatten([])).toEqual([]);
  });
});

describe("editing an anchored line's points", () => {
  it("knows smooth points from corners", () => {
    expect(isSmooth(smooth(500, 500, 600, 450), 0)).toBe(true);
    expect(isSmooth(corner(500, 500), 0)).toBe(false);
  });

  it("moves an anchor with its handles – kept in the area", () => {
    const a = smooth(500, 500, 600, 500);
    expect(moveAnchor(a, 0, 520, 480)).toEqual(smooth(520, 480, 620, 480));
    // Its handle reaches the edge first: it stops there.
    expect(moveAnchor(a, 0, 1000, 500)[4]).toBe(1024);
  });

  it("mirrors a smooth point's other handle – not with Alt", () => {
    const a = smooth(500, 500, 600, 500);
    expect(moveHandle(a, 0, "out", 500, 600).slice(2, 4)).toEqual([500, 400]);
    expect(moveHandle(a, 0, "out", 500, 600, true).slice(2, 4)).toEqual([
      400, 500,
    ]);
  });

  it("pulls a new anchor's handles out – Alt only the one", () => {
    expect(pullHandles(corner(500, 500), 0, 600, 550)).toEqual(
      smooth(500, 500, 600, 550)
    );
    expect(pullHandles(corner(500, 500), 0, 600, 550, true)).toEqual([
      500, 500, 500, 500, 600, 550,
    ]);
  });

  it("switches a point between smooth and corner", () => {
    const a = [...corner(100, 500), ...corner(500, 300), ...corner(900, 500)];
    const bent = toggleSmooth(a, false, 1);
    expect(isSmooth(bent, 1)).toBe(true);
    expect(toggleSmooth(bent, false, 1)).toEqual(a);
  });

  it("puts a new anchor on the line without changing its form", () => {
    const a = [...smooth(100, 500, 300, 100), ...smooth(800, 500, 900, 900)];
    const before = flatten(a);
    const { a: more, index } = insertAnchor(a, 0, 0.4);
    expect(index).toBe(1);
    expect(anchorCount(more)).toBe(3);
    for (const point of flatten(more)) {
      expect(off(point, before)).toBeLessThan(2);
    }
    expect(removeAnchor(more, 1)).toHaveLength(2 * ANCHOR);
  });

  it("grabs an anchor, a handle or the line – the line half its width wider", () => {
    const a = [...smooth(100, 500, 200, 400), ...corner(800, 500)];
    expect(pathGrip(a, false, 103, 502, 8)).toEqual({ kind: "anchor", i: 0 });
    expect(pathGrip(a, false, 198, 402, 8)).toEqual({ kind: "out", i: 0 });
    expect(pathGrip(a, false, 500, 520, 8)).toBeNull();
    expect(pathGrip(a, false, 500, 520, 8, 30)?.kind).toBe("line");
  });

  it("snaps to 45° about a point", () => {
    const [x, y] = snap45(100, 100, 200, 190);
    expect(x).toBeCloseTo(y);
  });

  it("snaps to the middle and the other anchors", () => {
    const guides = anchorGuides([[...corner(300, 700), ...corner(600, 200)]]);
    const at = snapPoint(509, 697, guides, 5);
    expect([at.x, at.y]).toEqual([512, 700]);
    expect(at.lines).toEqual({ x: [512], y: [700] });
  });
});

describe("anchored lines in the drawing", () => {
  const curve = lineStroke({ width: 20, emboss: true }, [
    ...smooth(200, 600, 300, 300),
    ...corner(800, 600),
  ]);

  it("are shared by their anchors – their points worked out anew", () => {
    const closed = lineStroke(
      { width: 16 },
      [...corner(100, 100), ...corner(400, 100), ...corner(250, 300)],
      true
    );
    const plain: Stroke = { width: 24, points: [[50, 900], [900, 900]] };
    const hash = share([curve, plain, closed]);
    expect(versionOf(hash)).toBe(5);
    const [a, b, c] = readHash(hash).drawing.strokes;
    expect(a).toEqual(curve);
    expect(b).toEqual(plain);
    expect(c).toEqual(closed);
  });

  it("leave links without them as they were", () => {
    const plain: Stroke = { width: 24, points: [[50, 900], [900, 900]] };
    expect(versionOf(share([plain]))).toBe(3);
    expect(versionOf(share([{ ...plain, emboss: true }]))).toBe(4);
  });

  it("move as a whole and stay anchored lines", () => {
    const drawing: Drawing = { base: [], baseLine: 0, strokes: [curve] };
    const [moved] = transformDrawing(
      drawing,
      { strokes: [0], rings: [] },
      { scale: 1, angle: Math.PI / 2, cx: 512, cy: 512, dx: 0, dy: 0 }
    ).strokes;
    expect(moved.anchors?.slice(0, 2)).toEqual([424, 200]);
    expect(moved.emboss).toBe(true);
    expect(moved.points).toEqual(flatten(moved.anchors ?? []));
  });

  it("are cut into ordinary strokes by the eraser", () => {
    const drawing: Drawing = { base: [], baseLine: 0, strokes: [curve] };
    const { strokes } = applyEraser(drawing, {
      width: 40,
      points: [[500, 0], [500, 1024]],
    });
    expect(strokes.length).toBeGreaterThan(0);
    for (const stroke of strokes) {
      expect(stroke.anchors).toBeUndefined();
      expect(stroke.emboss).toBe(true);
    }
  });
});
