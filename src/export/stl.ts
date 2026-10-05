import type { MeshData } from "../geometry/mesh";

/** Binäres STL: 80-Byte-Header, Dreiecksanzahl, je Dreieck Normale + 3 Vertices + 2 Byte Attribut. */
export const toStl = ({ positions, indices }: MeshData) => {
  const count = indices.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  view.setUint32(80, count, true);

  let offset = 84;
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
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
