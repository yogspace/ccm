import { strToU8, zipSync } from "fflate";
import type { MeshData } from "../geometry/mesh";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

const round = (value: number) => Math.round(value * 1e4) / 1e4;

export const toThreeMf = ({ positions, indices }: MeshData, title: string) => {
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">`,
    `<metadata name="Title">${title.replace(/[<>&"]/g, "")}</metadata>`,
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
