import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { MeshData } from "../geometry/mesh";

/**
 * The cutter as it comes off the printer, on a light stone slab in window
 * light, like a food photo: its walls in layers, its top in the top
 * layer's lines, deep shadows, the background out of focus. A
 * render to go along with real photos – the admin marks it as one.
 */

/** A printed layer's height and a top line's width (mm), as the 3MF prints. */
const LAYER = 0.2;
const LINE = 0.42;
/** What the slab fades into far behind: a dim grey. */
const BACKDROP = "#9c9b98";
const MAX_RENDER = 4096;

/** The same random numbers every time – the slab looks the same. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Light stone, drawn once into a texture that tiles: soft clouds in the
 * stone, pores and pale grains, a fine grain over all. It doubles as the
 * slab's bump map, so the window light catches the pores.
 */
const stoneTexture = (anisotropy: number) => {
  const size = 1024;
  const random = seeded(11);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#e3e2df";
    ctx.fillRect(0, 0, size, size);
    // Clouds near an edge go on across it: drawn once more past each side.
    const wrapped = [-size, 0, size];
    for (let i = 0; i < 70; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 40 + random() * 240;
      const light = random() < 0.5;
      const strength = 0.05 + random() * 0.08;
      for (const dx of wrapped) {
        for (const dy of wrapped) {
          const cloud = ctx.createRadialGradient(
            x + dx,
            y + dy,
            0,
            x + dx,
            y + dy,
            r
          );
          cloud.addColorStop(
            0,
            light
              ? `rgb(255 255 255 / ${strength * 1.4})`
              : `rgb(60 60 58 / ${strength})`
          );
          cloud.addColorStop(1, "rgb(0 0 0 / 0)");
          ctx.fillStyle = cloud;
          ctx.fillRect(0, 0, size, size);
        }
      }
    }
    // Pores and pale grains, a few pixels each.
    for (let i = 0; i < 9000; i++) {
      const light = random() < 0.3;
      ctx.fillStyle = light
        ? `rgb(255 255 255 / ${0.25 + random() * 0.4})`
        : `rgb(70 70 66 / ${0.08 + random() * 0.18})`;
      ctx.beginPath();
      ctx.arc(
        random() * size,
        random() * size,
        0.4 + random() ** 3 * 1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    const grain = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < grain.data.length; i += 4) {
      const n = (random() - 0.5) * 20;
      grain.data[i] += n;
      grain.data[i + 1] += n;
      grain.data[i + 2] += n;
    }
    ctx.putImageData(grain, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
};

/**
 * Where the rim stands on the slab, blurred: a contact shadow that grounds
 * it. Drawn from the triangles at the very bottom, seen from above.
 */
const contactShadow = (
  { positions, indices }: MeshData,
  bounds: THREE.Box3,
  margin: number
) => {
  const size = 512;
  const width = bounds.max.x - bounds.min.x + 2 * margin;
  const depth = bounds.max.y - bounds.min.y + 2 * margin;
  const scale = size / Math.max(width, depth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(depth * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const floor = bounds.min.z + 1;
  const x = (i: number) => (positions[i * 3] - bounds.min.x + margin) * scale;
  const y = (i: number) =>
    canvas.height - (positions[i * 3 + 1] - bounds.min.y + margin) * scale;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    if (
      positions[a * 3 + 2] > floor ||
      positions[b * 3 + 2] > floor ||
      positions[c * 3 + 2] > floor
    )
      continue;
    ctx.moveTo(x(a), y(a));
    ctx.lineTo(x(b), y(b));
    ctx.lineTo(x(c), y(c));
    ctx.closePath();
  }
  ctx.fill();
  const blurred = document.createElement("canvas");
  blurred.width = canvas.width;
  blurred.height = canvas.height;
  const soft = blurred.getContext("2d");
  if (!soft) return null;
  soft.filter = `blur(${margin * scale * 0.35}px)`;
  soft.drawImage(canvas, 0, 0);
  canvas.width = canvas.height = 0;
  const texture = new THREE.CanvasTexture(blurred);
  return { texture, width, depth };
};

const NOISE = `
varying vec3 vPrint;
float printHash(float n) { return fract(sin(n) * 43758.5453123); }
float printHash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float printNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(printHash3(i), printHash3(i + vec3(1, 0, 0)), f.x),
        mix(printHash3(i + vec3(0, 1, 0)), printHash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(printHash3(i + vec3(0, 0, 1)), printHash3(i + vec3(1, 0, 1)), f.x),
        mix(printHash3(i + vec3(0, 1, 1)), printHash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
// Where on a wall this is, worked out once in color_fragment, used after:
// how much it is a wall at all, and where across its layer's bead.
float printSide;
float printAcross;
float printBead;`;

/**
 * PLA as it prints: on the walls every layer a round bead, a dark groove
 * between two – the bead's back a little glossier than the groove; on top
 * faces the top layer's diagonal lines; the filament a little blotchy.
 * Lines too fine for a pixel fade out, so nothing flickers.
 */
const printMaterial = (color: string) => {
  // Satin, not lacquer: a soft sheen where the light grazes the walls.
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.6,
    sheen: 0.5,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35),
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPrint;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPrint = (modelMatrix * vec4(transformed, 1.0)).xyz;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= 1.0 + (printNoise(vPrint * 0.8) - 0.5) * 0.03;
        {
          vec3 up = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          float layer = vPrint.z / ${LAYER.toFixed(3)};
          printSide = (1.0 - smoothstep(0.5, 0.85, abs(dot(normalize(vNormal), up))))
            * (1.0 - smoothstep(0.3, 0.6, fwidth(layer)));
          // -1 at the groove below, +1 at the groove above; the bead's
          // height across it a half circle.
          printAcross = fract(layer) * 2.0 - 1.0;
          printBead = sqrt(max(0.0, 1.0 - printAcross * printAcross));
          diffuseColor.rgb *= mix(1.0, 0.6 + 0.4 * printBead, printSide);
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.8, 0.34, printBead), printSide);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec3 up = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          float facing = dot(normal, up);
          float index = floor(vPrint.z / ${LAYER.toFixed(3)});
          // The bead's flank: upward on its upper half, downward below.
          float tilt = clamp(printAcross / max(printBead, 0.2), -2.5, 2.5);
          float vary = 0.9 + printHash(index) * 0.2;
          normal = normalize(normal + up * tilt * 0.24 * vary * printSide);

          float line = (vPrint.x + vPrint.y) * 0.7071 / ${LINE.toFixed(3)};
          float topFace = smoothstep(0.85, 0.97, facing)
            * (1.0 - smoothstep(0.25, 0.5, fwidth(line)));
          vec3 across = normalize((viewMatrix * vec4(0.7071, -0.7071, 0.0, 0.0)).xyz);
          normal = normalize(normal + across * sin(line * 6.2831853) * 0.07 * topFace);
        }`
      );
  };
  return material;
};

/**
 * What a lens does: the slab far behind and right in front out of focus,
 * the cutter sharp; the corners a little darker.
 */
const develop = (source: HTMLCanvasElement, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);

  const blurred = document.createElement("canvas");
  blurred.width = width;
  blurred.height = height;
  const blur = blurred.getContext("2d");
  if (blur) {
    blur.filter = `blur(${Math.round(width / 180)}px)`;
    blur.drawImage(canvas, 0, 0);
    blur.filter = "none";
    blur.globalCompositeOperation = "destination-in";
    const focus = blur.createLinearGradient(0, 0, 0, height);
    focus.addColorStop(0, "rgb(0 0 0 / 1)");
    focus.addColorStop(0.3, "rgb(0 0 0 / 0)");
    focus.addColorStop(0.8, "rgb(0 0 0 / 0)");
    focus.addColorStop(1, "rgb(0 0 0 / 0.7)");
    blur.fillStyle = focus;
    blur.fillRect(0, 0, width, height);
    ctx.drawImage(blurred, 0, 0);
  }
  blurred.width = blurred.height = 0;

  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.55,
    Math.min(width, height) * 0.35,
    width / 2,
    height * 0.55,
    Math.hypot(width, height) * 0.62
  );
  vignette.addColorStop(0, "rgb(0 0 0 / 0)");
  vignette.addColorStop(1, "rgb(0 0 0 / 0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  return canvas;
};

/**
 * Renders the cutter standing on the slab (rim down, as it prints), seen
 * from the front and a little above, lit from the left. `supersample` as in
 * render-top.ts.
 */
export const renderPrintLook = (
  mesh: MeshData,
  color: string,
  width: number,
  height: number,
  supersample = 2
) => {
  const source = new THREE.BufferGeometry();
  source.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  source.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  source.computeBoundingBox();
  const bounds = source.boundingBox;
  if (!bounds) return null;
  // Smooth where the walls curve, sharp where they meet.
  const geometry = toCreasedNormals(source, THREE.MathUtils.degToRad(35));
  source.dispose();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
  const scale = Math.max(
    1,
    Math.min(supersample, MAX_RENDER / Math.max(width, height))
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(
    Math.round(width * scale),
    Math.round(height * scale),
    false
  );
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKDROP);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.3;

  // Standing on the slab, its rim at height 0, turned a little.
  const holder = new THREE.Group();
  holder.rotation.z = THREE.MathUtils.degToRad(-28);
  scene.add(holder);
  const material = printMaterial(color);
  const cutter = new THREE.Mesh(geometry, material);
  cutter.position.set(-center.x, -center.y, -bounds.min.z);
  cutter.castShadow = cutter.receiveShadow = true;
  holder.add(cutter);

  const contact = contactShadow(mesh, bounds, size.z * 0.6);
  let contactMaterial: THREE.MeshBasicMaterial | null = null;
  if (contact) {
    contactMaterial = new THREE.MeshBasicMaterial({
      map: contact.texture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      toneMapped: false,
    });
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(contact.width, contact.depth),
      contactMaterial
    );
    blob.position.z = 0.05;
    holder.add(blob);
  }

  const stone = stoneTexture(renderer.capabilities.getMaxAnisotropy());
  const tableSize = radius * 40;
  stone.repeat.set(tableSize / 260, tableSize / 260);
  const tableMaterial = new THREE.MeshStandardMaterial({
    map: stone,
    bumpMap: stone,
    bumpScale: 2,
    roughness: 0.82,
  });
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(tableSize, tableSize),
    tableMaterial
  );
  table.receiveShadow = true;
  scene.add(table);

  // Soft daylight from a big window on the left: shadows that fade out
  // instead of ending at a hard edge. The light slab throws some of it back
  // into the cutter, a cool glow comes from behind.
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.4);
  sun.position.set(-radius * 4, -radius * 0.6, radius * 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -radius * 2.5;
  sun.shadow.camera.right = sun.shadow.camera.top = radius * 2.5;
  sun.shadow.camera.near = radius;
  sun.shadow.camera.far = radius * 12;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 22;
  sun.shadow.blurSamples = 32;
  scene.add(sun);
  const bounce = new THREE.HemisphereLight(0xffffff, 0xe3e2df, 0.35);
  bounce.up.set(0, 0, 1);
  bounce.position.set(0, 0, 1);
  scene.add(bounce);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 0.5);
  rim.position.set(radius * 2, radius * 4, radius * 2);
  scene.add(rim);

  const fov = 24;
  const camera = new THREE.PerspectiveCamera(
    fov,
    width / height,
    1,
    radius * 80
  );
  camera.up.set(0, 0, 1);
  const elevation = THREE.MathUtils.degToRad(50);
  const azimuth = THREE.MathUtils.degToRad(-100);
  const fit = Math.min(1, width / height);
  const distance =
    (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * (0.98 / fit);
  camera.position.set(
    distance * Math.cos(elevation) * Math.cos(azimuth),
    distance * Math.cos(elevation) * Math.sin(azimuth),
    distance * Math.sin(elevation)
  );
  camera.lookAt(0, 0, size.z * 0.3);
  // The slab fades into the backdrop far behind.
  scene.fog = new THREE.Fog(BACKDROP, distance * 0.8, distance * 2.2);

  // Ambient occlusion: the soft dark where walls meet the rim and the rim
  // meets the slab, as every photo has it.
  const renderWidth = Math.round(width * scale);
  const renderHeight = Math.round(height * scale);
  const composer = new EffectComposer(renderer);
  composer.setSize(renderWidth, renderHeight);
  composer.addPass(new RenderPass(scene, camera));
  const occlusion = new GTAOPass(scene, camera, renderWidth, renderHeight);
  occlusion.updateGtaoMaterial({
    radius: radius * 0.12,
    distanceExponent: 1.5,
    thickness: radius * 0.05,
    scale: 1,
    samples: 16,
  });
  occlusion.blendIntensity = 0.85;
  composer.addPass(occlusion);
  composer.addPass(new OutputPass());
  composer.render();
  const canvas = develop(renderer.domElement, width, height);

  occlusion.dispose();
  composer.dispose();
  geometry.dispose();
  material.dispose();
  contact?.texture.dispose();
  contactMaterial?.dispose();
  table.geometry.dispose();
  tableMaterial.dispose();
  stone.dispose();
  environment.dispose();
  pmrem.dispose();
  room.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return canvas;
};
