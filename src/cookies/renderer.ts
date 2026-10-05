import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * Rendert die 3D-Keks-Icons. Jeder Keks hat seine eigene Canvas an seiner
 * Stelle im Layout; nur der WebGL-Kontext wird geteilt, weil Browser nur
 * wenige davon erlauben. Pro Frame wird jeder sichtbare, sich bewegende Keks
 * einzeln gerendert und in seine Canvas kopiert.
 */

/** Ab dieser Entfernung (px) reagiert ein Keks auf die Maus. */
const NEAR = 220;
const MAX_TURN = 0.75;

type Spring = { value: number; velocity: number; target: number };

const spring = (value = 0): Spring => ({ value, velocity: 0, target: value });

/** Gedämpfte Feder – überschwingt leicht, das wirkt lebendig. */
const step = (s: Spring, dt: number, stiffness = 170, damping = 14) => {
  const force = stiffness * (s.target - s.value) - damping * s.velocity;
  s.velocity += force * dt;
  s.value += s.velocity * dt;
};

const settled = (s: Spring) =>
  Math.abs(s.target - s.value) < 1e-4 && Math.abs(s.velocity) < 1e-4;

type Entry = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  object: THREE.Object3D;
  /** Grundneigung, damit die Kekse räumlich wirken. */
  tilt: number;
  /** Grunddrehung in der Bildebene. */
  roll: number;
  /** Sanftes Schweben im Leerlauf (kostet pro Frame ein Rendern). */
  idle: boolean;
  turnX: Spring;
  turnY: Spring;
  flip: Spring;
  squash: Spring;
  spin: boolean;
  phase: number;
  visible: boolean;
  drawn: boolean;
};

const entries = new Set<Entry>();
const pointer = { x: -1e6, y: -1e6 };
let reduceMotion = false;
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let frame = 0;
let last = 0;

const setup = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(256, 256, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setScissorTest(true);

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight("#fff4e0", 2.2);
  key.position.set(-2, 3, 5);
  scene.add(key, new THREE.HemisphereLight("#ffffff", "#7a6a8a", 0.6));

  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 5.4);

  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      wake();
    },
    { passive: true }
  );
};

const draw = (entry: Entry, time: number) => {
  if (!renderer) return;
  const { canvas, ctx, object } = entry;
  const { width, height } = canvas;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x < width || size.y < height) {
    renderer.setSize(Math.max(size.x, width), Math.max(size.y, height), false);
  }
  const bufferHeight = renderer.domElement.height;

  // Sanftes Schweben, Mausblick, Drehung beim Hover, Stauchen beim Klick.
  const idle =
    entry.idle && !reduceMotion ? Math.sin(time / 900 + entry.phase) * 0.06 : 0;
  object.rotation.set(
    entry.tilt + entry.turnX.value + idle,
    entry.turnY.value + entry.flip.value,
    entry.roll + (entry.spin ? time / 260 : idle * 0.5)
  );
  object.scale.set(1 + entry.squash.value * 0.5, 1 - entry.squash.value, 1);

  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  scene.add(object);
  renderer.render(scene, camera);
  scene.remove(object);

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(
    renderer.domElement,
    0,
    bufferHeight - height,
    width,
    height,
    0,
    0,
    width,
    height
  );
  entry.drawn = true;
};

const tick = (time: number) => {
  frame = 0;
  const dt = Math.min((time - (last || time)) / 1000, 1 / 30);
  last = time;
  let busy = false;

  for (const entry of entries) {
    if (!entry.visible) continue;
    const rect = entry.canvas.getBoundingClientRect();
    const dx = pointer.x - (rect.left + rect.width / 2);
    const dy = pointer.y - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    // Nur in der Nähe schaut der Keks zur Maus, sonst federt er zurück.
    const near = !reduceMotion && distance < NEAR;
    const strength = near ? 1 - distance / NEAR : 0;
    entry.turnY.target = near
      ? Math.max(-1, Math.min(1, dx / 90)) * MAX_TURN * (0.4 + strength * 0.6)
      : 0;
    entry.turnX.target = near
      ? Math.max(-1, Math.min(1, dy / 90)) * MAX_TURN * (0.4 + strength * 0.6)
      : 0;

    for (const s of [entry.turnX, entry.turnY]) step(s, dt);
    step(entry.flip, dt, 90, 11);
    step(entry.squash, dt, 380, 18);
    if (settled(entry.flip)) {
      // Nach einer vollen Drehung wieder bei 0 anfangen.
      entry.flip.value %= Math.PI * 2;
      entry.flip.target = entry.flip.value;
    }

    const moving =
      entry.spin ||
      (entry.idle && !reduceMotion) ||
      ![entry.turnX, entry.turnY, entry.flip, entry.squash].every(settled);
    if (moving || !entry.drawn) {
      draw(entry, time);
      busy = true;
    }
  }
  if (busy) wake();
  else last = 0;
};

const wake = () => {
  if (!frame && entries.size > 0) frame = requestAnimationFrame(tick);
};

export type CookieHandle = {
  setSpin: (spin: boolean) => void;
  /** Einmal um die eigene Achse – beim Hover über den zugehörigen Button. */
  flip: () => void;
  /** Kurz zusammendrücken – beim Klick. */
  press: () => void;
  dispose: () => void;
};

export const registerCookie = (
  canvas: HTMLCanvasElement,
  object: THREE.Object3D,
  { tilt = -0.55, roll = 0, idle = true } = {}
): CookieHandle => {
  if (!renderer) setup();
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const entry: Entry = {
    canvas,
    ctx,
    object,
    tilt,
    roll,
    idle,
    turnX: spring(),
    turnY: spring(),
    flip: spring(),
    squash: spring(),
    spin: false,
    phase: Math.random() * Math.PI * 2,
    visible: true,
    drawn: false,
  };
  entries.add(entry);

  const observer = new IntersectionObserver(([record]) => {
    entry.visible = record.isIntersecting;
    wake();
  });
  observer.observe(canvas);
  wake();

  return {
    setSpin: (spin) => {
      entry.spin = spin;
      wake();
    },
    flip: () => {
      if (reduceMotion) return;
      entry.flip.target += Math.PI * 2;
      wake();
    },
    press: () => {
      if (reduceMotion) return;
      entry.squash.velocity += 6;
      wake();
    },
    dispose: () => {
      observer.disconnect();
      entries.delete(entry);
    },
  };
};
