import type { Manifold } from "manifold-3d";

/** Raw triangle mesh in mm, independent of manifold and three.js. */
export type MeshData = {
  positions: Float32Array;
  indices: Uint32Array;
  dimensions: [number, number, number];
  /**
   * The embossing's triangles come last, from this index on – the view shows
   * them in the embossing ink. Without embossing: `indices.length`.
   */
  embossFrom: number;
};

/**
 * The mesh of a manifold – with `emboss` (an originalID), the triangles that
 * came from it sorted to the end. The order changes nothing else.
 */
export const toMeshData = (
  manifold: Manifold,
  emboss: number | null = null
): MeshData => {
  const mesh = manifold.getMesh();
  const box = manifold.boundingBox();
  const { numProp, vertProperties, triVerts, runIndex, runOriginalID } = mesh;

  const positions = new Float32Array((vertProperties.length / numProp) * 3);
  for (let i = 0, j = 0; i < vertProperties.length; i += numProp) {
    positions[j++] = vertProperties[i];
    positions[j++] = vertProperties[i + 1];
    positions[j++] = vertProperties[i + 2];
  }

  // Runs of triangles by where they came from: the embossing's to the end.
  const indices = new Uint32Array(triVerts.length);
  let embossFrom = triVerts.length;
  if (emboss === null) indices.set(triVerts);
  else {
    const runs = Array.from(runOriginalID, (id, run) => ({
      id,
      from: runIndex[run],
      to: runIndex[run + 1] ?? triVerts.length,
    }));
    let at = 0;
    for (const { from, to } of runs.filter(({ id }) => id !== emboss)) {
      indices.set(triVerts.subarray(from, to), at);
      at += to - from;
    }
    embossFrom = at;
    for (const { from, to } of runs.filter(({ id }) => id === emboss)) {
      indices.set(triVerts.subarray(from, to), at);
      at += to - from;
    }
  }

  return {
    positions,
    indices,
    dimensions: [
      box.max[0] - box.min[0],
      box.max[1] - box.min[1],
      box.max[2] - box.min[2],
    ],
    embossFrom,
  };
};
