import { memo, type Ref, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useSnapshot } from "valtio";
import { FILAMENTS } from "../filaments";
import type { MeshData } from "../geometry/mesh";
import { stopAutoRotate, store } from "../store";

/** From outside: render a picture of the cutter from a bird's eye view. */
export type PreviewHandle = {
  /**
   * Transparent picture of size width × height, or `null` without a model –
   * in the filament colour on screen unless `color` says otherwise.
   */
  renderTop: (
    width: number,
    height: number,
    color?: string
  ) => HTMLCanvasElement | null;
};

type Props = {
  ref?: Ref<PreviewHandle>;
};

type View = {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  object: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  rise: () => void;
  /** Turntable on/off. */
  spin: { on: boolean };
};

/** Turntable speed in rad/s – one turn in a good 20 seconds. */
const SPIN_SPEED = 0.3;

const RISE_MS = 700;

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

/**
 * Renders the cutter as in the preview (cutting edge up) from slightly above –
 * with its own short-lived renderer.
 */
const renderTopView = (
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

/**
 * 3D view of the cutter. Reads model, contour and turntable from the store; a
 * new contour (a new motif) lets the model grow from the floor again. Turning
 * it yourself stops the turntable.
 */
const Preview3d = ({ ref }: Props) => {
  const { cutter, rings: shape, autoRotate } = useSnapshot(store);
  const mesh: MeshData | null = cutter.mesh;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>(null);
  const fittedSize = useRef(0);
  const pendingRise = useRef(true);

  useImperativeHandle(
    ref,
    () => ({
      renderTop: (width, height, color) => {
        const view = viewRef.current;
        const geometry = view?.object.geometry;
        if (!view || !geometry?.getAttribute("position")) return null;
        return renderTopView(
          geometry,
          color ? new THREE.Color(color) : view.object.material.color,
          width,
          height
        );
      },
    }),
    []
  );

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

    // Turntable: the floor grid and the model turn together, like a plate.
    const turntable = new THREE.Group();
    scene.add(turntable);

    // White "table" with a cream grid – like the drawing area.
    const grid = new THREE.GridHelper(300, 30, 0xcdbfa7, 0xe4dac8);
    grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true;
    grid.material.opacity = 0.9;
    turntable.add(grid);

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      flatShading: true,
    });
    const object = new THREE.Mesh(new THREE.BufferGeometry(), material);
    turntable.add(object);

    let filament = pickFilament("");
    material.color.set(filament);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.addEventListener("start", stopAutoRotate);

    let riseStart = -Infinity;
    const rise = () => {
      // Every new cutter switches colour right away, without a cross-fade.
      filament = pickFilament(filament);
      material.color.set(filament);
      // New shape: reset the turntable so it starts aligned like the drawing.
      turntable.rotation.z = 0;
      if (!reducedMotion()) riseStart = performance.now();
    };

    // The turntable spins (not the camera): time-based and clockwise seen from
    // above – a negative rotation around the z axis.
    const spin = { on: false };
    let lastTime = 0;
    renderer.setAnimationLoop((time) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;
      if (spin.on) turntable.rotation.z -= SPIN_SPEED * dt;
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

    viewRef.current = { camera, controls, object, rise, spin };
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
      viewRef.current.spin.on = autoRotate && !reducedMotion();
    }
  }, [autoRotate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately reacts to new motifs only
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
    // No normals: flat shading computes them in the shader from the faces.
    object.geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    if (pendingRise.current) {
      pendingRise.current = false;
      rise();
    }

    // Only move the camera when the size changes noticeably.
    const size = Math.max(...mesh.dimensions);
    if (Math.abs(size - fittedSize.current) > size * 0.3) {
      fittedSize.current = size;
      const height = mesh.dimensions[2];
      controls.target.set(0, 0, height / 3);
      // From the front: the cutter stands like the drawing (top = back).
      camera.position.set(0, -size * 1.45, size * 1.15 + height);
    }
  }, [mesh]);

  return <div className="preview" ref={containerRef} />;
};

export default memo(Preview3d);
