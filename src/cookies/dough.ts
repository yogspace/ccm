import * as THREE from "three";

/** What every cookie is made of: its dough, its height, its sprinkles. */

/**
 * The cookies' colors – from the CMS (“Site” global → Cookies; the sprinkles
 * are the card colors and white), set by the page before the first cookie
 * is baked (setCookieColors). These are the code's own, until then.
 */
const palette = {
  dough: "#d4914c",
  chocolate: "#4a2a17",
  sprinkles: ["#2a44ff", "#ff6a1f", "#ff5fa8", "#5fb36b", "#ffc31f", "#ffffff"],
};

export type CookieColors = typeof palette;

/** The cookies' colors from the CMS – before any cookie is baked. */
export const setCookieColors = ({
  dough,
  chocolate,
  sprinkles,
}: CookieColors) => {
  const next = {
    dough: dough.toLowerCase(),
    chocolate: chocolate.toLowerCase(),
    sprinkles: sprinkles.map((color) => color.toLowerCase()),
  };
  if (JSON.stringify(next) === JSON.stringify(palette)) return;
  Object.assign(palette, next);
  doughCache.clear();
};

/** One dough's color – the admin's preview, while it is being picked. */
export const setDoughColor = (dough: Dough, color: string) =>
  setCookieColors({
    ...palette,
    [dough === "plain" ? "dough" : "chocolate"]: color,
  });

export const chocolateColor = () => palette.chocolate;

type Lab = [number, number, number];

/** A color in OKLab: lightness and two color axes, as the eye sees them. */
const toLab = (color: string): Lab => {
  const { r, g, b } = new THREE.Color(color).getRGB(
    { r: 0, g: 0, b: 0 },
    THREE.LinearSRGBColorSpace
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const fromLab = ([L, a, b]: Lab) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return `#${new THREE.Color()
    .setRGB(
      clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
      THREE.LinearSRGBColorSpace
    )
    .getHexString(THREE.SRGBColorSpace)}`;
};

/** Closer than this (OKLab), a sprinkle would melt into what it lies on. */
const CLOSE = 0.14;
/** How far a sprinkle's lightness then moves away from it. */
const APART = 0.24;

const distance = (a: Lab, b: Lab) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * A sprinkle's color, picked by `random` from the card colors and white –
 * set off from `ground`, what it lies on (the icing, or the dough): one too
 * close to it gets a little lighter or darker, away from it, keeping its
 * hue; white, which has none to keep, gives way to the next color that
 * stands out.
 */
export const sprinkleColor = (random: () => number, ground?: string) => {
  const { sprinkles } = palette;
  const color = sprinkles[Math.floor(random() * sprinkles.length)];
  if (!ground) return color;
  const under = toLab(ground);
  const own = toLab(color);
  if (distance(own, under) >= CLOSE) return color;
  if (Math.hypot(own[1], own[2]) < 0.03) {
    const other = sprinkles.find(
      (next) => distance(toLab(next), under) >= CLOSE
    );
    if (other) return other;
  }
  const lighter = under[0] < 0.6;
  const lightness = lighter
    ? Math.max(own[0], under[0] + APART)
    : Math.min(own[0], under[0] - APART);
  return fromLab([Math.min(0.97, Math.max(0.3, lightness)), own[1], own[2]]);
};

export const DEPTH = 0.16;
export const BEVEL = 0.13;
export const TOP = DEPTH + BEVEL;

/** Deterministic randomness, so every cookie always looks the same. */
export const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

/**
 * The doughs as tuned for the code's own colors: its color, its darker and
 * lighter specks, its sheen and how matt it is. Chocolate warm and rich, a
 * little glossy – not burnt; its dough tuned to the chocolate chips' color.
 */
const TUNED = {
  plain: {
    from: "#d4914c",
    base: "#d4914c",
    dark: "#803e12",
    light: "#ffe4b4",
    sheen: "#ffd9a0",
    roughness: 0.78,
  },
  chocolate: {
    from: "#4a2a17",
    base: "#46271a",
    dark: "#24120a",
    light: "#74482f",
    sheen: "#7e5541",
    roughness: 0.6,
  },
} as const;

export type Dough = keyof typeof TUNED;

const hsl = (color: string) =>
  new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);

/**
 * A shade of `color` as `shade` is of `reference` – turned as far in hue,
 * its saturation and lightness moved alike: down in proportion, up as far
 * towards full (so a light color's lighter shade nears white, never past
 * it). Of the reference itself: the shade, exactly.
 */
const alike = (color: string, reference: string, shade: string) => {
  const c = hsl(color);
  const r = hsl(reference);
  const s = hsl(shade);
  const scale = (value: number, from: number, to: number) =>
    to <= from
      ? from > 0
        ? value * (to / from)
        : value
      : value + (1 - value) * ((to - from) / (1 - from));
  return new THREE.Color().setHSL(
    c.h + s.h - r.h,
    scale(c.s, r.s, s.s),
    scale(c.l, r.l, s.l),
    THREE.SRGBColorSpace
  );
};

/** A dough in the CMS's colors: the tuned one, carried over. */
export const doughLook = (dough: Dough = "plain") => {
  const tuned = TUNED[dough];
  const from = dough === "plain" ? palette.dough : palette.chocolate;
  const shade = (of: string) => alike(from, tuned.from, of);
  return {
    base: shade(tuned.base),
    dark: shade(tuned.dark),
    light: shade(tuned.light),
    sheen: shade(tuned.sheen),
    roughness: tuned.roughness,
  };
};

const doughCache = new Map<
  Dough,
  { map: THREE.Texture; bumpMap: THREE.Texture }
>();

/** As "r g b" (0–255), for `rgb(… / alpha)`. */
const channels = (color: THREE.Color) => {
  const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  return [r, g, b].map((v) => Math.round(v * 255)).join(" ");
};

/** Dough texture: color variations and browned specks, plus a bump map. */
export const doughTextures = (dough: Dough = "plain") => {
  const cached = doughCache.get(dough);
  if (cached) return cached;
  const look = doughLook(dough);
  const base = `#${look.base.getHexString(THREE.SRGBColorSpace)}`;
  const darker = channels(look.dark);
  const light = channels(look.light);
  const random = seeded(5);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const dark = random() < 0.55;
    ctx.fillStyle = dark
      ? `rgb(${darker} / ${0.12 + random() * 0.28})`
      : `rgb(${light} / ${0.08 + random() * 0.2})`;
    ctx.beginPath();
    ctx.arc(
      random() * 512,
      random() * 512,
      0.6 + random() * 3.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.9, 0.9);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = bumpCanvas.height = 256;
  const bump = bumpCanvas.getContext("2d") as CanvasRenderingContext2D;
  bump.fillStyle = "#808080";
  bump.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const value = Math.floor(80 + random() * 120);
    bump.fillStyle = `rgb(${value},${value},${value})`;
    bump.beginPath();
    bump.arc(
      random() * 256,
      random() * 256,
      0.5 + random() * 2.5,
      0,
      Math.PI * 2
    );
    bump.fill();
  }
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const textures = { map, bumpMap };
  doughCache.set(dough, textures);
  return textures;
};

/** Is `p` inside the ring (even–odd)? */
export const inside = (points: THREE.Vector2[], p: THREE.Vector2) => {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      hit = !hit;
    }
  }
  return hit;
};

/** Frees a baked cookie's geometries and materials (the dough texture stays). */
export const disposeCookie = (object: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      geometries.add(child.geometry);
      for (const material of [child.material].flat()) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
};
