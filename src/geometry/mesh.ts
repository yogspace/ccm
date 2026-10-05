import type { Manifold } from "manifold-3d";

/** Rohdaten eines Dreiecksnetzes in mm, unabhängig von manifold und three.js. */
export type MeshData = {
  positions: Float32Array;
  indices: Uint32Array;
  dimensions: [number, number, number];
};

export const toMeshData = (manifold: Manifold): MeshData => {
  const mesh = manifold.getMesh();
  const box = manifold.boundingBox();
  const { numProp, vertProperties } = mesh;

  const positions = new Float32Array((vertProperties.length / numProp) * 3);
  for (let i = 0, j = 0; i < vertProperties.length; i += numProp) {
    positions[j++] = vertProperties[i];
    positions[j++] = vertProperties[i + 1];
    positions[j++] = vertProperties[i + 2];
  }

  return {
    positions,
    indices: mesh.triVerts.slice(),
    dimensions: [
      box.max[0] - box.min[0],
      box.max[1] - box.min[1],
      box.max[2] - box.min[2],
    ],
  };
};
