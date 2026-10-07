import * as THREE from "three";
import type { MeshData } from "./geometry/mesh";

/**
 * Renders the cutter as in the preview (cutting edge up) from slightly above –
 * with its own short-lived renderer.
 */
export const renderTopView = (
  geometry: THREE.BufferGeometry,
  color: THREE.Color,
  width: number,
  height: number
) => {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return null;
  const size = bounds.getSize(new THREE.Vector3());

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-60, 80, 200);
  scene.add(sun);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    flatShading: true,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const camera = new THREE.PerspectiveCamera(28, width / height, 1, 5000);
  camera.up.set(0, 1, 0);
  const radius = Math.hypot(size.x, size.y) / 2;
  const fit = Math.min(1, width / height);
  const distance =
    (radius / Math.sin(THREE.MathUtils.degToRad(14))) * (1.08 / fit);
  // Slightly from the front, so the walls get some depth.
  const tilt = THREE.MathUtils.degToRad(18);
  camera.position.set(0, -distance * Math.sin(tilt), distance * Math.cos(tilt));
  camera.lookAt(0, 0, size.z / 2);

  renderer.render(scene, camera);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(renderer.domElement, 0, 0);
  material.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return canvas;
};

/** The same from raw mesh data – where there is no 3D view (the card page). */
export const renderMeshTop = (
  mesh: MeshData,
  color: string,
  width: number,
  height: number
) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(mesh.positions, 3)
  );
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  const canvas = renderTopView(geometry, new THREE.Color(color), width, height);
  geometry.dispose();
  return canvas;
};
