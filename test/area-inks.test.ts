import { describe, expect, it } from "vitest";
import {
  removeSelection,
  selectionInk,
  setStrokeInk,
  transformDrawing,
} from "../src/drawing";
import { defaultParams } from "../src/geometry/cutter";
import type { Ring } from "../src/geometry/outline";
import { type Drawing, hasEmboss, readHash, writeHash } from "../src/url-state";

const square = (x: number, y: number, side: number): Ring => [
  [x, y],
  [x + side, y],
  [x + side, y + side],
  [x, y + side],
];

/** An imported area: a square with a hole, and a square on its own. */
const imported: Drawing = {
  base: [square(0.1, 0.1, 0.4), square(0.2, 0.2, 0.2), square(0.6, 0.6, 0.3)],
  baseLine: 0,
  strokes: [
    {
      width: 24,
      points: [
        [100, 900],
        [900, 900],
      ],
    },
  ],
};
/** The first object – the square and its hole. */
const first = { strokes: [], rings: [0, 1] };

describe("an imported area", () => {
  it("is put into the embossing ink by its objects", () => {
    const pink = setStrokeInk(imported, first, "emboss");
    expect(pink.baseEmboss).toEqual([true, true, false]);
    expect(hasEmboss(pink)).toBe(true);
    expect(selectionInk(pink, first)).toBe("emboss");
    expect(selectionInk(pink, { strokes: [], rings: [2] })).toBe("cut");
    // Back to cutting: nothing pink is left to keep.
    expect(setStrokeInk(pink, first, "cut").baseEmboss).toBeUndefined();
  });

  it("keeps each contour's ink when moved or partly removed", () => {
    const pink = setStrokeInk(imported, first, "emboss");
    const moved = transformDrawing(pink, first, {
      scale: 1,
      cx: 0,
      cy: 0,
      dx: 10,
      dy: 0,
    });
    expect(moved.baseEmboss).toEqual([true, true, false]);
    const rest = removeSelection(pink, { strokes: [], rings: [2] });
    expect(rest.baseEmboss).toEqual([true, true]);
    expect(
      removeSelection(pink, first).baseEmboss,
      "only cut contours left"
    ).toBeUndefined();
  });

  it("is shared in its inks – old links stay as they were", () => {
    const share = (drawing: Drawing) =>
      writeHash({ name: "", params: defaultParams, drawing });
    const pink = setStrokeInk(imported, first, "emboss");
    const back = readHash(share(pink)).drawing;
    expect(back.baseEmboss).toEqual([true, true, false]);
    expect(back.base).toHaveLength(3);
    expect(readHash(share(imported)).drawing.baseEmboss).toBeUndefined();
  });
});
