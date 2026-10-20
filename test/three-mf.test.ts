import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { toThreeMf } from "../src/export/three-mf";
import type { MeshData } from "../src/geometry/mesh";

// A 40 × 30 × 12 mm box, off the origin as a cutter may come.
const box = (): MeshData => {
  const [x0, y0, x1, y1, z1] = [10, -20, 50, 10, 12];
  const corners = [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y1, 0],
    [x0, y1, 0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  const indices = new Uint32Array(faces.flat());
  return {
    positions: new Float32Array(corners.flat()),
    indices,
    dimensions: [x1 - x0, y1 - y0, z1],
    embossFrom: indices.length,
  };
};

const unpack = async (file: Blob) =>
  unzipSync(new Uint8Array(await file.arrayBuffer()));

describe("3MF", () => {
  it("is a Bambu Studio project for an A1 with Bambu PLA Basic", async () => {
    const files = await unpack(
      await toThreeMf(box(), "Star & Moon", "#2a44ff")
    );
    for (const name of [
      "[Content_Types].xml",
      "_rels/.rels",
      "3D/3dmodel.model",
      "3D/_rels/3dmodel.model.rels",
      "3D/Objects/object_1.model",
      "Metadata/project_settings.config",
      "Metadata/model_settings.config",
      "Metadata/slice_info.config",
    ]) {
      expect(files[name], name).toBeDefined();
    }

    const model = strFromU8(files["3D/3dmodel.model"]);
    expect(model).toMatch(
      /<metadata name="Application">BambuStudio-[\d.]+<\/metadata>/
    );
    expect(model).toContain(
      '<metadata name="Title">Star &amp; Moon</metadata>'
    );

    const settings = JSON.parse(
      strFromU8(files["Metadata/project_settings.config"])
    );
    expect(settings.printer_model).toBe("Bambu Lab A1");
    expect(settings.printer_settings_id).toBe("Bambu Lab A1 0.4 nozzle");
    expect(settings.print_settings_id).toBe("0.20mm Standard @BBL A1");
    expect(settings.filament_settings_id).toEqual(["Bambu PLA Basic @BBL A1"]);
    expect(settings.printable_area).toEqual([
      "0x0",
      "256x0",
      "256x256",
      "0x256",
    ]);
    expect(settings.machine_start_gcode.length).toBeGreaterThan(1000);
    expect(settings.filament_colour).toEqual(["#2A44FF"]);
  });

  it("puts the cutter in the middle of the plate, standing on it", async () => {
    const files = await unpack(await toThreeMf(box(), "Box"));
    const model = strFromU8(files["3D/3dmodel.model"]);
    const object = strFromU8(files["3D/Objects/object_1.model"]);

    const transform = (tag: string) =>
      (model.match(new RegExp(`<${tag} [^>]*transform="([^"]+)"`))?.[1] ?? "")
        .split(" ")
        .slice(9)
        .map(Number);
    const [cx, cy, cz] = transform("component");
    const [ix, iy, iz] = transform("item");

    const vertices = [
      ...object.matchAll(/x="([^"]+)" y="([^"]+)" z="([^"]+)"/g),
    ].map((match) => match.slice(1).map(Number));
    const world = vertices.map(([x, y, z]) => [
      x + cx + ix,
      y + cy + iy,
      z + cz + iz,
    ]);
    const along = (axis: number) => world.map((point) => point[axis]);

    expect(Math.min(...along(0)) + Math.max(...along(0))).toBeCloseTo(256);
    expect(Math.min(...along(1)) + Math.max(...along(1))).toBeCloseTo(256);
    expect(Math.min(...along(2))).toBeCloseTo(0);
    expect(Math.max(...along(2))).toBeCloseTo(12);
  });
});
