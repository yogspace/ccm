import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MeshData } from "../geometry/mesh";

type Props = {
  mesh: MeshData;
  color: string;
  label: string;
  /** Wait (ms) before the cutter grows up out of the card. */
  delay?: number;
};

const RISE_MS = 900;
/** How far (rad) the cutter sways to and fro. */
const SWAY = 0.2;

const easeOutBack = (t: number) => {
  const c = 1.5;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/**
 * The cutter lying on the card, seen from slightly in front: it grows up out
 * of the paper and then sways gently – the card itself leans with the pointer.
 */
const CardCutter = ({ mesh, color, label, delay = 0 }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a94b8, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-70, -40, 160);
    scene.add(sun);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(mesh.positions, 3)
    );
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      flatShading: true,
    });
    const cutter = new THREE.Mesh(geometry, material);
    const sway = new THREE.Group();
    sway.add(cutter);
    scene.add(sway);

    // Fit it, seen from in front and above – like the share picture.
    const [width, depth, height] = mesh.dimensions;
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 5000);
    camera.up.set(0, 1, 0);
    const radius = Math.hypot(width, depth) / 2 + 2;
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(13))) * 1.02;
    const tilt = THREE.MathUtils.degToRad(24);
    camera.position.set(
      0,
      -distance * Math.sin(tilt),
      distance * Math.cos(tilt)
    );
    camera.lookAt(0, 0, height * 0.3);

    const start = performance.now() + delay;
    renderer.setAnimationLoop((time) => {
      const t = Math.min(1, Math.max(0, (time - start) / RISE_MS));
      cutter.scale.z = still ? 1 : Math.max(0.001, easeOutBack(t));
      if (!still) sway.rotation.z = Math.sin(time / 2600) * SWAY;
      renderer.render(scene, camera);
    });

    const observer = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      // Narrow views pull back, so it never gets cut off at the sides.
      camera.zoom = Math.min(1, camera.aspect);
      camera.updateProjectionMatrix();
    });
    observer.observe(container);

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mesh, color, delay]);

  return (
    <div
      aria-label={label}
      className="card-cutter"
      ref={containerRef}
      role="img"
    />
  );
};

export default CardCutter;
