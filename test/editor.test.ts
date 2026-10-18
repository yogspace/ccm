import { describe, expect, it } from "vitest";
import { lineStroke } from "../src/bezier";
import { frameAfter, frameAround, grip, turnAbout } from "../src/draw/frame";
import { keepLine, steady } from "../src/draw/freehand";
import { moveWithin, sizing, TURN_STEP, turning } from "../src/draw/gestures";
import { linesAt, snapMove, snapPoint } from "../src/draw/guides";
import {
  keptView,
  MAX_ZOOM,
  movedBy,
  pinched,
  toArea,
  toStage,
  WHOLE,
  zoomedAbout,
} from "../src/draw/view";
import {
  addCopies,
  pickDrawing,
  pointsOf,
  toggleSelection,
  transformBy,
} from "../src/drawing";
import type { Point } from "../src/geometry/outline";
import type { Drawing } from "../src/url-state";

/** Numbers that look random but come again – a hand's tremor. */
const shaky = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648 - 0.5;
  };
};

/** A circle drawn by a shaky finger – its points, every few pixels. */
const drawn = (jitter: number) => {
  const noise = shaky(7);
  return Array.from({ length: 240 }, (_, i): Point => {
    const a = (i / 239) * Math.PI * 1.8;
    return [
      512 + Math.cos(a) * 300 + noise() * jitter,
      512 + Math.sin(a) * 300 + noise() * jitter,
    ];
  });
};

/** How much a line turns back and forth – its wobble. */
const wobble = (p: readonly Point[]) => {
  let sum = 0;
  let n = 0;
  for (let i = 1; i + 1 < p.length; i++) {
    const a = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]);
    const b = Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]);
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    sum += d * d;
    n++;
  }
  return sum / n;
};

/** Points along a line at least `step` apart – to compare wobbles fairly. */
const spaced = (p: readonly Point[], step: number) => {
  const out: Point[] = [p[0]];
  for (const q of p) {
    const last = out[out.length - 1];
    if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= step) out.push(q);
  }
  return out;
};

const through = (points: Point[], reach: number) => {
  const brush = steady(points[0][0], points[0][1], { reach });
  const line: Point[] = [points[0]];
  for (const [x, y] of points.slice(1, -1)) line.push(...brush.to(x, y));
  const [ex, ey] = points[points.length - 1];
  line.push(...brush.end(ex, ey));
  return line;
};

describe("a freehand line", () => {
  it("leaves a shaky hand's tremor behind – and runs where it was drawn", () => {
    const raw = drawn(12);
    const calm = through(raw, 12);
    expect(wobble(spaced(calm, 10))).toBeLessThan(wobble(spaced(raw, 10)) / 3);
    const off = calm.map(([x, y]) =>
      Math.abs(Math.hypot(x - 512, y - 512) - 300)
    );
    expect(off.reduce((a, b) => a + b, 0) / off.length).toBeLessThan(8);
  });

  it("begins where it was put down, ends where it was let go", () => {
    const raw = drawn(10);
    const calm = through(raw, 12);
    expect(calm[0]).toEqual(raw[0]);
    expect(calm[calm.length - 1]).toEqual(raw[raw.length - 1]);
  });

  it("stays put while the pointer trembles within reach", () => {
    const brush = steady(500, 500, { reach: 10 });
    const noise = shaky(3);
    for (let i = 0; i < 50; i++) {
      expect(brush.to(500 + noise() * 15, 500 + noise() * 15)).toEqual([]);
    }
  });

  it("keeps only the points it needs – a corner sharp, a dot a dot", () => {
    const side: Point[] = [
      ...Array.from({ length: 200 }, (_, i): Point => [100 + i * 2, 100]),
      ...Array.from({ length: 200 }, (_, i): Point => [500, 100 + i * 2]),
    ];
    const kept = keepLine(side, 1);
    expect(kept.length).toBeLessThan(6);
    expect(kept).toContainEqual([500, 100]);
    expect(keepLine([[300, 300]], 1)).toEqual([[300, 300]]);
  });

  it("keeps a small wiggle bigger than its tolerance", () => {
    const wiggle: Point[] = Array.from({ length: 100 }, (_, i) => [
      200 + i * 4,
      500 + (i % 20 < 10 ? 0 : 10),
    ]);
    const ys = keepLine(wiggle, 2).map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(10);
  });
});

describe("zooming into the drawing area", () => {
  it("keeps what is under the pointer under it", () => {
    const view = zoomedAbout(WHOLE, 2, 0.25, 0.75);
    expect(view.s).toBe(2);
    const [ax, ay] = toArea(view, 0.25, 0.75);
    expect(ax).toBeCloseTo(0.25, 9);
    expect(ay).toBeCloseTo(0.75, 9);
    const [sx, sy] = toStage(view, ax, ay);
    expect(sx).toBeCloseTo(0.25, 9);
    expect(sy).toBeCloseTo(0.75, 9);
  });

  it("never goes beside the area, nor out further than all of it", () => {
    expect(keptView({ s: 0.5, x: 0.3, y: -2 })).toEqual(WHOLE);
    expect(keptView({ s: 99, x: 0, y: 0 }).s).toBe(MAX_ZOOM);
    expect(movedBy({ s: 2, x: -0.5, y: -0.5 }, 5, -5)).toEqual({
      s: 2,
      x: 0,
      y: -1,
    });
  });

  it("follows two fingers – apart it zooms, along it moves", () => {
    const view = pinched(
      WHOLE,
      [
        [0.4, 0.5],
        [0.6, 0.5],
      ],
      [
        [0.3, 0.5],
        [0.7, 0.5],
      ]
    );
    expect(view.s).toBeCloseTo(2, 9);
    expect(toArea(view, 0.5, 0.5)[0]).toBeCloseTo(0.5, 9);
    const along = pinched(
      { s: 2, x: -0.5, y: -0.5 },
      [
        [0.4, 0.5],
        [0.6, 0.5],
      ],
      [
        [0.5, 0.5],
        [0.7, 0.5],
      ]
    );
    expect(along.s).toBeCloseTo(2, 9);
    expect(along.x).toBeCloseTo(-0.4, 9);
  });
});

describe("moving, sizing and turning what is selected", () => {
  // A square, 200 px, at 100–300.
  const box = { x0: 100, y0: 100, x1: 300, y1: 300 };
  const frame = frameAround(box);
  const points = [100, 100, 300, 100, 300, 300, 100, 300];

  it("stops at the area's edge", () => {
    expect(moveWithin(points, -150, 50)).toEqual([-100, 50]);
    expect(moveWithin(points, 900, 900)).toEqual([724, 724]);
  });

  it("sizes by a corner – the opposite one stays; ⇧ in proportion", () => {
    const m = sizing(frame, points, [1, 1], [300, 300], [400, 350]);
    const f = frameAfter(frame, m);
    expect(f.cx - f.w / 2).toBeCloseTo(100, 6);
    expect(f.w).toBeCloseTo(300, 6);
    expect(f.h).toBeCloseTo(250, 6);
    const even = frameAfter(
      frame,
      sizing(frame, points, [1, 1], [300, 300], [400, 350], { even: true })
    );
    expect(even.w).toBeCloseTo(even.h, 6);
  });

  it("sizes by a side along it – Alt about the middle – never below a least size", () => {
    const side = frameAfter(
      frame,
      sizing(frame, points, [1, 0], [300, 200], [350, 260])
    );
    expect(side.w).toBeCloseTo(250, 6);
    expect(side.h).toBeCloseTo(200, 6);
    const centered = frameAfter(
      frame,
      sizing(frame, points, [1, 0], [300, 200], [350, 200], { centered: true })
    );
    expect(centered.cx).toBeCloseTo(200, 6);
    expect(centered.w).toBeCloseTo(300, 6);
    const least = frameAfter(
      frame,
      sizing(frame, points, [1, 1], [300, 300], [0, 0])
    );
    expect(least.w).toBeGreaterThanOrEqual(16 - 1e-6);
  });

  it("never sizes past the edge", () => {
    const m = sizing(frame, points, [-1, -1], [100, 100], [-300, -300]);
    const f = frameAfter(frame, m);
    expect(f.cx - f.w / 2).toBeGreaterThanOrEqual(-1e-3);
    expect(f.cy - f.h / 2).toBeGreaterThanOrEqual(-1e-3);
  });

  it("turns about its middle – in 15° steps with ⇧, pushed back onto the area", () => {
    const m = turning(frame, points, [300, 100], [310, 120], true);
    const f = frameAfter(frame, m);
    expect(Math.abs(f.angle % TURN_STEP)).toBeLessThan(1e-9);
    // In the corner: turned 45°, it would stick out – it is pushed in.
    const corner = frameAround({ x0: 0, y0: 0, x1: 200, y1: 200 });
    const cornerPoints = [0, 0, 200, 0, 200, 200, 0, 200];
    const turned = turning(corner, cornerPoints, [200, 0], [241, 100], false);
    for (let i = 0; i < cornerPoints.length; i += 2) {
      const x =
        turned[0] * cornerPoints[i] +
        turned[2] * cornerPoints[i + 1] +
        turned[4];
      const y =
        turned[1] * cornerPoints[i] +
        turned[3] * cornerPoints[i + 1] +
        turned[5];
      expect(x).toBeGreaterThanOrEqual(-1e-3);
      expect(y).toBeGreaterThanOrEqual(-1e-3);
    }
  });

  it("knows what a press grabs: a corner, a side, just outside a corner, the inside, the knob", () => {
    const options = { reach: 8, turn: 22, knob: 30 };
    expect(grip(frame, 301, 299, options)).toEqual({
      kind: "size",
      handle: [1, 1],
    });
    expect(grip(frame, 200, 302, options)).toEqual({
      kind: "size",
      handle: [0, 1],
    });
    expect(grip(frame, 315, 85, options)).toEqual({ kind: "turn" });
    expect(grip(frame, 200, 200, options)).toEqual({ kind: "move" });
    expect(grip(frame, 200, 70, options)).toEqual({ kind: "turn" });
    expect(grip(frame, 500, 500, options)).toBeNull();
  });
});

describe("smart guides", () => {
  const guides = { x: [512, 600, 700], y: [512, 300] };

  it("pull a box's middle onto the area's – and the box's edges onto others'", () => {
    const box = { x0: 180, y0: 180, x1: 220, y1: 220 };
    const [dx, dy] = snapMove(box, 309, 100, guides, 5);
    expect(box.x0 + dx + 20).toBe(512);
    expect(dy).toBe(100);
    expect(linesAt({ x0: 492, y0: 280, x1: 532, y1: 320 }, guides)).toEqual({
      x: [512],
      y: [300],
    });
  });

  it("let go further off – and leave an axis that may not move", () => {
    const box = { x0: 180, y0: 180, x1: 220, y1: 220 };
    expect(snapMove(box, 280, 0, guides, 5)).toEqual([280, 0]);
    expect(snapMove(box, 309, 0, guides, 5, { x: false, y: true })).toEqual([
      309, 0,
    ]);
    const at = snapPoint(598, 303, guides, 5, { x: true, y: false });
    expect([at.x, at.y]).toEqual([600, 303]);
    expect(at.lines).toEqual({ x: [600], y: [] });
  });
});

describe("the drawing changed by the move tool", () => {
  const drawing: Drawing = {
    base: [
      [
        [0.1, 0.1],
        [0.2, 0.1],
        [0.2, 0.2],
      ],
    ],
    baseLine: 0,
    baseEmboss: [true],
    strokes: [
      {
        width: 20,
        points: [
          [500, 500],
          [600, 500],
        ],
      },
      lineStroke(
        { width: 12, emboss: true },
        [300, 300, 300, 300, 300, 300, 400, 300, 400, 300, 400, 300]
      ),
    ],
  };

  it("keeps each line's width when sizing – and an anchored line anchored", () => {
    const sized = transformBy(
      drawing,
      { strokes: [0, 1], rings: [] },
      [2, 0, 0, 2, 0, 0]
    );
    expect(sized.strokes[0]).toEqual({
      width: 20,
      points: [
        [1000, 1000],
        [1200, 1000],
      ],
    });
    expect(sized.strokes[1].width).toBe(12);
    expect(sized.strokes[1].emboss).toBe(true);
    expect(sized.strokes[1].anchors?.slice(0, 2)).toEqual([600, 600]);
  });

  it("knows the points that must stay on the area – an anchored line's anchors too", () => {
    expect(pointsOf(drawing, { strokes: [1], rings: [0] })).toEqual([
      300, 300, 400, 300, 300, 300, 400, 300, 102.4, 102.4, 204.8, 102.4, 204.8,
      204.8,
    ]);
  });

  it("lays copies on top, moved and selected – the area's inks kept", () => {
    const copies = pickDrawing(drawing, { strokes: [0], rings: [0] });
    const added = addCopies(drawing, copies, 30, 30, moveWithin);
    expect(added?.selection).toEqual({ strokes: [2], rings: [1] });
    expect(added?.drawing.strokes[2].points[0]).toEqual([530, 530]);
    expect(added?.drawing.baseEmboss).toEqual([true, true]);
  });

  it("adds with ⇧ – or takes away what is in it", () => {
    const a = { strokes: [0], rings: [] };
    const b = { strokes: [1], rings: [0] };
    expect(toggleSelection(a, b)).toEqual({ strokes: [0, 1], rings: [0] });
    expect(toggleSelection({ strokes: [0, 1], rings: [0] }, b)).toEqual(a);
  });

  it("turns with the frame's matrices", () => {
    const [moved] = transformBy(
      drawing,
      { strokes: [0], rings: [] },
      turnAbout(Math.PI / 2, 512, 512)
    ).strokes;
    expect(moved.points[0][0]).toBeCloseTo(524, 6);
    expect(moved.points[0][1]).toBeCloseTo(500, 6);
  });
});
