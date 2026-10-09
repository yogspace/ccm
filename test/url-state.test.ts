import { inflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { defaultParams } from "../src/geometry/cutter";
import { currentForm } from "../src/link-keys";
import {
  type Drawing,
  emptyDrawing,
  readHash,
  writeHash,
} from "../src/url-state";

const share = (drawing: Drawing) =>
  writeHash({ name: "", params: defaultParams, drawing });

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

const line = (y: number) =>
  Array.from({ length: 12 }, (_, i): [number, number] => [100 + i * 40, y]);

describe("links", () => {
  it("keep each stroke's ink", () => {
    const drawing: Drawing = {
      base: [],
      baseLine: 0,
      strokes: [
        { width: 24, points: line(200) },
        { width: 12, points: line(400), emboss: true },
        { width: 30, points: line(600), erase: true },
      ],
    };
    const hash = share(drawing);
    expect(versionOf(hash)).toBe(4);
    const { strokes } = readHash(hash).drawing;
    expect(
      strokes.map(({ width, emboss, erase }) => [width, emboss, erase])
    ).toEqual([
      [24, undefined, undefined],
      [12, true, undefined],
      [30, undefined, true],
    ]);
  });

  it("write the dimensions by their letters", () => {
    const params = { ...defaultParams, size: 90, bladeHeight: 12, mirror: 1 };
    const hash = writeHash({ name: "Ottifant", params, drawing: emptyDrawing });
    expect(hash).toBe("#n=Ottifant&z=90&h=12&x=1");
    expect(readHash(hash).params).toEqual(params);
  });

  it("still read older ones, spelled out", () => {
    const drawing: Drawing = {
      base: [],
      baseLine: 0,
      strokes: [{ width: 24, points: line(200) }],
    };
    const params = { ...defaultParams, size: 90, bridgeWidth: 4, relief: 2 };
    const today = writeHash({ name: "Ottifant", params, drawing });
    const s = new URLSearchParams(today.slice(1)).get("s");
    const older = `#n=Ottifant&size=90&bridgeWidth=4&relief=2&s=${s}`;
    expect(readHash(older).params).toEqual(params);
    expect(readHash(older).drawing).toEqual(readHash(today).drawing);
    // Saved from an older link, a cookie still matches the same creation.
    expect(currentForm(older)).toBe(today);
    expect(currentForm(today)).toBe(today);
  });

  it("stay as they were without embossing", () => {
    const drawing: Drawing = {
      base: [],
      baseLine: 0,
      strokes: [{ width: 24, points: line(200) }],
    };
    const hash = share(drawing);
    expect(versionOf(hash)).toBe(3);
    expect(readHash(hash).drawing.strokes[0].width).toBe(24);
  });
});
