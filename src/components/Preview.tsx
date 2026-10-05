import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CutterMesh } from "../geometry/cutter";

type Scene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  render: () => void;
};

const Preview = ({ cutter }: { cutter: CutterMesh | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>(null);
  const fittedSize = useRef(0);

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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(60, -80, 150);
    scene.add(sun);

    const grid = new THREE.GridHelper(200, 20, 0x888888, 0x888888);
    grid.rotation.x = Math.PI / 2;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    scene.add(grid);

    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xe0874a,
        roughness: 0.55,
        flatShading: true,
      })
    );
    scene.add(mesh);

    const render = () => renderer.render(scene, camera);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener("change", render);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    sceneRef.current = { renderer, camera, controls, mesh, render };
    return () => {
      observer.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = sceneRef.current;
    if (!view) return;
    const { mesh, camera, controls, render } = view;

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BufferGeometry();
    if (cutter) {
      mesh.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(cutter.positions, 3)
      );
      mesh.geometry.setIndex(new THREE.BufferAttribute(cutter.indices, 1));
      mesh.geometry.computeVertexNormals();

      // Kamera nur nachführen, wenn sich die Größe deutlich ändert.
      const size = Math.max(...cutter.dimensions);
      if (Math.abs(size - fittedSize.current) > size * 0.3) {
        fittedSize.current = size;
        const height = cutter.dimensions[2];
        controls.target.set(0, 0, height / 3);
        camera.position.set(size * 0.6, -size * 1.2, size * 1.1 + height);
        controls.update();
      }
    }
    render();
  }, [cutter]);

  return <div className="preview" ref={containerRef} />;
};

export default Preview;
