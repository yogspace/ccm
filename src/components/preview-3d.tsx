import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MeshData } from "../geometry/mesh";

type Props = {
  mesh: MeshData | null;
  /** Neue Identität = neues Motiv → das Modell wächst neu aus dem Boden. */
  shape: unknown;
  autoRotate: boolean;
  /** Wer selbst dreht, beendet die automatische Drehung. */
  onUserRotate: () => void;
};

type View = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  object: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  rise: () => void;
};

const RISE_MS = 700;

/** Filamentfarben – jeder neue Ausstecher bekommt eine andere. */
const FILAMENTS = [
  "#2a44ff", // Luminous Blue
  "#ff6a1f", // Energy Orange
  "#ff5fa8", // Pop Pink
  "#5fb36b", // Meadowland Green
  "#c4825f", // Clay
  "#ffc31f",
  "#13b0a5",
];

const pickFilament = (previous: string) => {
  const options = FILAMENTS.filter((color) => color !== previous);
  return options[Math.floor(Math.random() * options.length)];
};

const easeOutBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Preview3d = ({ mesh, shape, autoRotate, onUserRotate }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(null);
  const fittedSize = useRef(0);
  const pendingRise = useRef(true);
  const onUserRotateRef = useRef(onUserRotate);
  onUserRotateRef.current = onUserRotate;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
    camera.up.set(0, 0, 1);
    camera.position.set(80, -120, 110);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(60, -80, 150);
    scene.add(sun);

    const grid = new THREE.GridHelper(300, 30, 0x888888, 0x888888);
    grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    scene.add(grid);

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      flatShading: true,
    });
    const object = new THREE.Mesh(new THREE.BufferGeometry(), material);
    scene.add(object);

    let filament = pickFilament("");
    material.color.set(filament);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // Negativ: Das Modell dreht sich im Uhrzeigersinn (von oben gesehen).
    controls.autoRotateSpeed = -1.2;
    controls.addEventListener("start", () => onUserRotateRef.current());

    let riseStart = -Infinity;
    const rise = () => {
      // Jeder neue Ausstecher wechselt sofort die Farbe, ohne Überblendung.
      filament = pickFilament(filament);
      material.color.set(filament);
      if (!reducedMotion()) riseStart = performance.now();
    };

    renderer.setAnimationLoop((time) => {
      const t = Math.min(1, (time - riseStart) / RISE_MS);
      object.scale.z = Math.max(0.001, easeOutBack(t));
      controls.update();
      renderer.render(scene, camera);
    });

    const observer = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    });
    observer.observe(container);

    viewRef.current = { camera, controls, object, rise };
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      object.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.controls.autoRotate = autoRotate && !reducedMotion();
    }
  }, [autoRotate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reagiert bewusst nur auf neue Motive
  useEffect(() => {
    pendingRise.current = true;
  }, [shape]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const { object, camera, controls, rise } = view;

    object.geometry.dispose();
    object.geometry = new THREE.BufferGeometry();
    if (!mesh) return;

    object.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(mesh.positions, 3)
    );
    object.geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    object.geometry.computeVertexNormals();

    if (pendingRise.current) {
      pendingRise.current = false;
      rise();
    }

    // Kamera nur nachführen, wenn sich die Größe deutlich ändert.
    const size = Math.max(...mesh.dimensions);
    if (Math.abs(size - fittedSize.current) > size * 0.3) {
      fittedSize.current = size;
      const height = mesh.dimensions[2];
      controls.target.set(0, 0, height / 3);
      camera.position.set(size * 0.7, -size * 1.3, size * 1.1 + height);
    }
  }, [mesh]);

  return <div className="preview" ref={containerRef} />;
};

export default Preview3d;
