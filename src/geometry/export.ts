import { strToU8, zipSync } from "fflate";
import type { CutterMesh } from "./cutter";

export const toStl = ({ positions, indices }: CutterMesh) => {
  const count = indices.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  view.setUint32(80, count, true);

  let offset = 84;
  for (let t = 0; t < count; t++) {
    const [a, b, c] = [0, 1, 2].map((k) => indices[t * 3 + k] * 3);
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    for (const value of [nx / length, ny / length, nz / length]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    for (const vertex of [a, b, c]) {
      for (let k = 0; k < 3; k++) {
        view.setFloat32(offset, positions[vertex + k], true);
        offset += 4;
      }
    }
    offset += 2;
  }
  return new Blob([buffer], { type: "model/stl" });
};

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

const round = (value: number) => Math.round(value * 1e4) / 1e4;

export const to3mf = ({ positions, indices }: CutterMesh, name: string) => {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">`,
    `<metadata name="Title">${name.replace(/[<>&"]/g, "")}</metadata>`,
    `<resources><object id="1" type="model"><mesh><vertices>`,
  ];
  for (let i = 0; i < positions.length; i += 3) {
    parts.push(
      `<vertex x="${round(positions[i])}" y="${round(positions[i + 1])}" z="${round(positions[i + 2])}"/>`
    );
  }
  parts.push("</vertices><triangles>");
  for (let i = 0; i < indices.length; i += 3) {
    parts.push(
      `<triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`
    );
  }
  parts.push(
    `</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`
  );

  const zip = zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "3D/3dmodel.model": strToU8(parts.join("\n")),
  });
  return new Blob([zip], { type: "model/3mf" });
};

export const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
