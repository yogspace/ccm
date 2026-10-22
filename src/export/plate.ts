import type { MeshData } from "../geometry/mesh";

/**
 * Several cutters at once – a set: where each goes on the A1's plates, and
 * all of them as one mesh, laid out like that, for the pictures.
 */

/** The A1's plate is 256 mm square. */
export const PLATE = 256;
/** Room between cutters on a plate (mm) … */
const GAP = 8;
/** … and along its edges. */
const EDGE = 6;

/** A cutter's place: its plate (from 0) and its middle on it (mm, y back). */
export type Place = { plate: number; x: number; y: number };

/** Where a mesh's box is: its middle and its bottom. */
export const boxOf = ({ positions }: MeshData) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return { min, max };
};

/**
 * Row by row from the back, in the order given, each plate's rows centered
 * on it; what doesn't fit goes on the next plate. `width` and `depth` are
 * the room for them – on a plate, the plate less its edges. A cutter larger
 * than that lies on a plate of its own.
 */
export const arrange = (
  sizes: [number, number][],
  width = PLATE - 2 * EDGE,
  depth = PLATE - 2 * EDGE
): Place[] => {
  type Row = { items: number[]; width: number; depth: number };
  const plates: Row[][] = [[]];
  for (const [index, [w, d]] of sizes.entries()) {
    const rows = plates[plates.length - 1];
    const row = rows[rows.length - 1];
    if (row && row.width + GAP + w <= width) {
      // Beside the last one – if the rows still fit with it.
      const deeper = Math.max(row.depth, d);
      const total = rows.reduce((sum, r) => sum + r.depth + GAP, -GAP);
      if (total - row.depth + deeper <= depth) {
        row.items.push(index);
        row.width += GAP + w;
        row.depth = deeper;
        continue;
      }
    }
    // Below the others – or, without room for it, on the next plate.
    const total = rows.reduce((sum, r) => sum + r.depth + GAP, 0);
    const fresh: Row = { items: [index], width: w, depth: d };
    if (rows.length === 0 || total + d <= depth) rows.push(fresh);
    else plates.push([fresh]);
  }

  // On a plate centered on it; without bounds (pictures) about 0.
  const middleX = Number.isFinite(width) ? width / 2 + EDGE : 0;
  const middleY = Number.isFinite(depth) ? depth / 2 + EDGE : 0;
  const places: Place[] = [];
  for (const [plate, rows] of plates.entries()) {
    const block = rows.reduce((sum, row) => sum + row.depth + GAP, -GAP);
    let top = middleY + block / 2;
    for (const row of rows) {
      let x = middleX - row.width / 2;
      const y = top - row.depth / 2;
      for (const index of row.items) {
        const [w] = sizes[index];
        places[index] = { plate, x: x + w / 2, y };
        x += w + GAP;
      }
      top -= row.depth + GAP;
    }
  }
  return places;
};

/**
 * The meshes as one, each moved to its place (`x`, `y`: its middle, on the
 * floor) – the plates side by side are not kept apart. Like a single
 * cutter's, the whole is centered on the origin, the views fit it there.
 * The embossing of all of them comes last, as in each.
 */
export const mergeMeshes = (
  meshes: MeshData[],
  places: { x: number; y: number }[]
): MeshData => {
  const vertexCount = meshes.reduce((sum, m) => sum + m.positions.length, 0);
  const indexCount = meshes.reduce((sum, m) => sum + m.indices.length, 0);
  const positions = new Float32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  const plain = meshes.reduce((sum, m) => sum + m.embossFrom, 0);
  let vertexAt = 0;
  let plainAt = 0;
  let embossAt = plain;
  for (const [i, mesh] of meshes.entries()) {
    const { min, max } = boxOf(mesh);
    const shift = [
      places[i].x - (min[0] + max[0]) / 2,
      places[i].y - (min[1] + max[1]) / 2,
      -min[2],
    ];
    for (let k = 0; k < mesh.positions.length; k++) {
      positions[vertexAt * 3 + k] = mesh.positions[k] + shift[k % 3];
    }
    for (let k = 0; k < mesh.indices.length; k++) {
      const index = mesh.indices[k] + vertexAt;
      if (k < mesh.embossFrom) indices[plainAt++] = index;
      else indices[embossAt++] = index;
    }
    vertexAt += mesh.positions.length / 3;
  }
  const merged = { positions, indices, embossFrom: plain };
  const { min, max } = boxOf({ ...merged, dimensions: [0, 0, 0] });
  const middle = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  for (let k = 0; k < positions.length; k += 3) {
    positions[k] -= middle[0];
    positions[k + 1] -= middle[1];
  }
  return {
    ...merged,
    dimensions: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
};
