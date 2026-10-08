import * as THREE from "three";
import type { Ring } from "../geometry/outline";

/** The app's cookie icons. */
export type CookieKind =
  | "bite"
  | "chip"
  | "heart"
  | "star"
  | "flower"
  | "gingerbread"
  | "sun";

const DOUGH = "#d4914c";
const CHOCOLATE = "#4a2a17";
const SPRINKLES = [
  "#2a44ff",
  "#ff6a1f",
  "#ff5fa8",
  "#5fb36b",
  "#ffc31f",
  "#ffffff",
];

const DEPTH = 0.16;
const BEVEL = 0.13;
const TOP = DEPTH + BEVEL;

/** Deterministic randomness, so every cookie always looks the same. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

let doughCache: { map: THREE.Texture; bumpMap: THREE.Texture } | undefined;

/** Dough texture: colour variations and browned specks, plus a bump map. */
const doughTextures = () => {
  if (doughCache) return doughCache;
  const random = seeded(5);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = DOUGH;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const dark = random() < 0.55;
    ctx.fillStyle = dark
      ? `rgba(128, 62, 18, ${0.12 + random() * 0.28})`
      : `rgba(255, 228, 180, ${0.08 + random() * 0.2})`;
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

  doughCache = { map, bumpMap };
  return doughCache;
};

/** Normalises a contour to width/height ≈ 2 around the origin. */
const normalize = (points: THREE.Vector2[]) => {
  const box = new THREE.Box2().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector2());
  const size = box.getSize(new THREE.Vector2());
  const scale = 2 / Math.max(size.x, size.y);
  return points.map((p) => p.clone().sub(center).multiplyScalar(scale));
};

const circle = (n = 160) =>
  Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  });

/** Round with a bite: push points inside the bite circles onto their edge. */
const bitten = () => {
  const bites = [
    { c: new THREE.Vector2(0.86, 0.62), r: 0.36 },
    { c: new THREE.Vector2(1.02, 0.28), r: 0.3 },
    { c: new THREE.Vector2(0.62, 0.92), r: 0.28 },
  ];
  return circle(240).map((p) => {
    let q = p.clone();
    for (const { c, r } of bites) {
      const d = q.clone().sub(c);
      if (d.length() < r) q = c.clone().add(d.setLength(r));
    }
    return q;
  });
};

const heart = () => {
  const shape = new THREE.Shape();
  shape.moveTo(5, 5);
  shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
  shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
  shape.bezierCurveTo(7, 0, 5, 5, 5, 5);
  return normalize(
    shape.getPoints(64).map((p) => new THREE.Vector2(p.x, -p.y))
  );
};

/** Star with rounded tips. */
const star = (spikes = 5, inner = 0.52) => {
  const corners = Array.from({ length: spikes * 2 }, (_, i) => {
    const angle = Math.PI / 2 + (i / (spikes * 2)) * Math.PI * 2;
    const radius = i % 2 ? inner : 1;
    return new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  });
  const mid = (a: THREE.Vector2, b: THREE.Vector2) =>
    a.clone().add(b).multiplyScalar(0.5);
  const shape = new THREE.Shape();
  const start = mid(corners[0], corners[1]);
  shape.moveTo(start.x, start.y);
  corners.forEach((_, i) => {
    const corner = corners[(i + 1) % corners.length];
    const next = mid(corner, corners[(i + 2) % corners.length]);
    shape.quadraticCurveTo(corner.x, corner.y, next.x, next.y);
  });
  return normalize(shape.getPoints(24));
};

const inside = (points: THREE.Vector2[], p: THREE.Vector2) => {
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

/** Random points inside the contour, not too close together. */
const scatter = (
  points: THREE.Vector2[],
  count: number,
  margin: number,
  random: () => number
) => {
  const inner = points.map((p) => p.clone().multiplyScalar(1 - margin));
  const result: THREE.Vector2[] = [];
  for (let guard = 0; result.length < count && guard < 5000; guard++) {
    const p = new THREE.Vector2(random() * 2 - 1, random() * 2 - 1);
    if (inside(inner, p) && result.every((q) => q.distanceTo(p) > 0.17)) {
      result.push(p);
    }
  }
  return result;
};

type OutlineKind = "bite" | "chip" | "heart" | "star";

const outlines: Record<OutlineKind, () => THREE.Vector2[]> = {
  bite: bitten,
  chip: () => circle(),
  heart,
  star,
};

const seeds: Record<OutlineKind, number> = {
  bite: 11,
  chip: 7,
  heart: 23,
  star: 41,
};

const build = (kind: OutlineKind) => {
  const random = seeded(seeds[kind]);
  const group = new THREE.Group();
  const outline = outlines[kind]();

  const { map, bumpMap } = doughTextures();
  group.add(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(new THREE.Shape(outline), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: 0.11,
        bevelSegments: 8,
        curveSegments: 32,
      }),
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap,
        bumpScale: 1.4,
        roughness: 0.78,
        sheen: 0.4,
        sheenColor: new THREE.Color("#ffd9a0"),
      })
    )
  );

  if (kind === "chip" || kind === "bite") {
    const chocolate = new THREE.MeshPhysicalMaterial({
      color: CHOCOLATE,
      roughness: 0.35,
      clearcoat: 0.4,
    });
    for (const p of scatter(outline, kind === "bite" ? 7 : 9, 0.22, random)) {
      const chip = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.11 + random() * 0.05, 1),
        chocolate
      );
      chip.scale.set(1 + random() * 0.4, 1 + random() * 0.3, 0.62);
      chip.rotation.set(random(), random(), random() * Math.PI);
      chip.position.set(p.x, p.y, TOP - 0.02);
      group.add(chip);
    }
    return group;
  }

  // Icing: a slightly smaller shape, glossy, with sprinkles.
  const icingColor = kind === "heart" ? "#ff5fa8" : "#ffffff";
  const icingOutline = outline.map((p) => p.clone().multiplyScalar(0.84));
  const icing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(new THREE.Shape(icingOutline), {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 6,
      curveSegments: 32,
    }),
    new THREE.MeshPhysicalMaterial({
      color: icingColor,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    })
  );
  icing.position.z = TOP - 0.03;
  group.add(icing);

  const sprinkle = new THREE.CapsuleGeometry(0.022, 0.08, 4, 8);
  for (const p of scatter(
    icingOutline,
    kind === "heart" ? 16 : 18,
    0.12,
    random
  )) {
    const color = SPRINKLES[Math.floor(random() * SPRINKLES.length)];
    const mesh = new THREE.Mesh(
      sprinkle,
      new THREE.MeshPhysicalMaterial({
        color: color === icingColor ? "#2a44ff" : color,
        roughness: 0.35,
        clearcoat: 0.6,
      })
    );
    mesh.rotation.set(Math.PI / 2, 0, random() * Math.PI);
    mesh.rotateZ(random() * Math.PI);
    mesh.position.set(p.x, p.y, TOP + 0.06);
    group.add(mesh);
  }
  return group;
};

/** Contour of an SVG (alpha > 50 %), normalised to ±1 (viewBox 24, y up). */
const traceSvg = async (markup: string) => {
  const RES = 128;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = RES + 4;
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  ctx.drawImage(image, 2, 2, RES, RES);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const values = Array.from(
    { length: canvas.width * canvas.height },
    (_, i) => data[i * 4 + 3] / 255
  );
  const { contours } = await import("d3-contour");
  const [level] = contours()
    .size([canvas.width, canvas.height])
    .thresholds([0.5])(values);
  const half = canvas.width / 2;
  return level.coordinates.map((polygon) =>
    polygon.map((ring) =>
      ring.map(
        ([x, y]) => new THREE.Vector2((x - half) / half, (half - y) / half)
      )
    )
  );
};

/** Polygons (outer ring + holes) as three.js shapes. */
const toShapes = (polygons: THREE.Vector2[][][]) =>
  polygons.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(outer);
    shape.holes = holes.map((hole) => new THREE.Path(hole));
    return shape;
  });

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128">${body}</svg>`;

type SvgCookie = {
  /** SVG of the dough (everything opaque becomes cookie). */
  dough: string;
  /** SVG of the icing on top. */
  glaze: string;
  glazeColor: string;
  /** Tints the dough, e.g. darker for gingerbread. */
  tint?: string;
  depth?: number;
};

const buildSvgCookie = async ({
  dough,
  glaze,
  glazeColor,
  tint = "#ffffff",
  depth = 0.1,
}: SvgCookie) => {
  const [doughShape, glazeShape] = await Promise.all([
    traceSvg(dough),
    traceSvg(glaze),
  ]);
  const group = new THREE.Group();
  const { map, bumpMap } = doughTextures();
  group.add(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(toShapes(doughShape), {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.09,
        bevelSize: 0.05,
        bevelSegments: 6,
      }),
      new THREE.MeshPhysicalMaterial({
        color: tint,
        map,
        bumpMap,
        bumpScale: 1.2,
        roughness: 0.78,
        sheen: 0.4,
        sheenColor: new THREE.Color("#ffd9a0"),
      })
    )
  );
  const glazeMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(toShapes(glazeShape), {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.025,
      bevelSegments: 5,
    }),
    new THREE.MeshPhysicalMaterial({
      color: glazeColor,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
    })
  );
  glazeMesh.position.z = depth + 0.07;
  group.add(glazeMesh);
  return group;
};

const GINGERBREAD: SvgCookie = {
  dough: svg(`<g fill="#000" stroke="#000" stroke-linecap="round">
    <circle cx="12" cy="5" r="3.4" stroke="none"/>
    <rect x="8.2" y="7.4" width="7.6" height="8.6" rx="3" stroke="none"/>
    <path d="M8.8 10 4.4 12.6M15.2 10l4.4 2.6" stroke-width="3.4" fill="none"/>
    <path d="M10.2 15 8 20.8M13.8 15l2.2 5.8" stroke-width="3.6" fill="none"/>
  </g>`),
  glaze:
    svg(`<g fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10.8" cy="4.5" r="0.6" stroke="none"/>
    <circle cx="13.2" cy="4.5" r="0.6" stroke="none"/>
    <path d="M10.6 6.2q1.4 1.1 2.8 0" stroke-width="0.6" fill="none"/>
    <circle cx="12" cy="10" r="0.7" stroke="none"/>
    <circle cx="12" cy="12.4" r="0.7" stroke="none"/>
    <path d="m4.5 11.2.7 1.3.7-1.3M18.1 11.2l.7 1.3.7-1.3M7.4 19.2l.7 1.3.7-1.3M15.2 19.2l.7 1.3.7-1.3" stroke-width="0.55" fill="none"/>
  </g>`),
  glazeColor: "#ffffff",
  tint: "#b8794a",
  depth: 0.14,
};

const FLOWER: SvgCookie = {
  dough: svg(`<g fill="#000">
    ${Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      return `<circle cx="${12 + Math.cos(angle) * 5.6}" cy="${12 + Math.sin(angle) * 5.6}" r="4.4"/>`;
    }).join("")}
    <circle cx="12" cy="12" r="6"/>
  </g>`),
  glaze: svg(`<g fill="#000"><circle cx="12" cy="12" r="3.4"/>
    ${Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return `<circle cx="${12 + Math.cos(angle) * 6.2}" cy="${12 + Math.sin(angle) * 6.2}" r="0.9"/>`;
    }).join("")}
  </g>`),
  glazeColor: "#ffc31f",
  depth: 0.12,
};

/** Star-shaped ring around the centre (on the SVGs' 24 grid). */
const burst = (rays: number, outer: number, inner: number) =>
  Array.from({ length: rays * 2 }, (_, i) => {
    const radius = i % 2 ? inner : outer;
    const angle = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

/** Sun with yellow icing – carries the donation link. */
const SUN: SvgCookie = {
  dough: svg(
    `<polygon fill="#000" stroke="#000" stroke-width="0.6" stroke-linejoin="round" points="${burst(16, 11.2, 9.3)}"/>`
  ),
  glaze: svg(
    `<polygon fill="#000" stroke="#000" stroke-width="0.5" stroke-linejoin="round" points="${burst(16, 9.4, 8)}"/>`
  ),
  glazeColor: "#ffc31f",
  depth: 0.12,
};

const cache = new Map<CookieKind, Promise<THREE.Group>>();

/** Returns a cookie; geometries and materials are shared between copies. */
export const createCookie = (kind: CookieKind) => {
  let original = cache.get(kind);
  if (!original) {
    original =
      kind === "gingerbread"
        ? buildSvgCookie(GINGERBREAD)
        : kind === "flower"
          ? buildSvgCookie(FLOWER)
          : kind === "sun"
            ? buildSvgCookie(SUN)
            : Promise.resolve(build(kind));
    cache.set(kind, original);
  }
  return original.then((group) => group.clone());
};

const iconCache = new Map<string, Promise<THREE.Group>>();

/** Lucide icon with its own stroke width as SVG markup. */
const iconMarkup = (icon: SVGSVGElement, strokeWidth: number) => {
  const clone = icon.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "128");
  clone.setAttribute("height", "128");
  clone.setAttribute("stroke", "#000");
  clone.setAttribute("stroke-width", String(strokeWidth));
  return new XMLSerializer().serializeToString(clone);
};

/**
 * Cookie in the shape of an icon: the icon's line thick as dough, on top the
 * same line thinner as icing.
 */
export const createIconCookie = (
  icon: SVGSVGElement,
  key: string,
  glazeColor: string
) => {
  const cacheKey = `${key}:${glazeColor}`;
  let pending = iconCache.get(cacheKey);
  if (!pending) {
    pending = buildSvgCookie({
      dough: iconMarkup(icon, 3.6),
      glaze: iconMarkup(icon, 1.7),
      glazeColor,
    });
    iconCache.set(cacheKey, pending);
  }
  return pending.then((group) => group.clone());
};

/**
 * A cookie in the shape of a creation: its contours like the drawing's (0…1,
 * y down) – the dough and the icing poured on top (see `buildCutter`).
 */
export type CookieShape = {
  dough: Ring[];
  icing: Ring[];
  /** Picks the icing colour and where the sprinkles land. */
  seed: number;
};

/** Mostly white icing, sometimes coloured. */
const ICINGS = ["#ffffff", "#ffffff", "#ff5fa8", "#ffc31f", "#a9b6ff"];

/** Rings as three.js shapes: each outer ring with the holes right inside it. */
const nest = (rings: THREE.Vector2[][]) => {
  const area = (ring: THREE.Vector2[]) => Math.abs(THREE.ShapeUtils.area(ring));
  const depth = rings.map(
    (ring, i) =>
      rings.filter((other, j) => j !== i && inside(other, ring[0])).length
  );
  const shapes = new Map<number, THREE.Shape>();
  for (const [i, ring] of rings.entries()) {
    if (depth[i] % 2 === 0) shapes.set(i, new THREE.Shape(ring));
  }
  for (const [i, ring] of rings.entries()) {
    if (depth[i] % 2 === 0) continue;
    const parent = [...shapes.keys()]
      .filter((j) => depth[j] === depth[i] - 1 && inside(rings[j], ring[0]))
      .sort((a, b) => area(rings[a]) - area(rings[b]))[0];
    shapes.get(parent)?.holes.push(new THREE.Path(ring));
  }
  return [...shapes.values()];
};

/** Distance from a point to the nearest edge of the rings. */
const edgeDistance = (rings: THREE.Vector2[][], p: THREE.Vector2) => {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = dx * dx + dy * dy;
      const t =
        length > 0
          ? Math.max(
              0,
              Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)
            )
          : 0;
      best = Math.min(best, Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y));
    }
  }
  return best;
};

/** Random points on the rings' area (even–odd), off their edges, spread out. */
const sprinkleSpots = (
  rings: THREE.Vector2[][],
  margin: number,
  random: () => number
) => {
  const box = new THREE.Box2().setFromPoints(rings.flat());
  const size = box.getSize(new THREE.Vector2());
  const covered = (p: THREE.Vector2) =>
    rings.filter((ring) => inside(ring, p)).length % 2 === 1;
  // Area by sampling – how many sprinkles fit.
  let hits = 0;
  for (let i = 0; i < 400; i++) {
    const p = new THREE.Vector2(
      box.min.x + random() * size.x,
      box.min.y + random() * size.y
    );
    if (covered(p)) hits++;
  }
  const area = (hits / 400) * size.x * size.y;
  const count = Math.max(4, Math.min(40, Math.round(area * 7)));
  const spots: THREE.Vector2[] = [];
  for (let guard = 0; spots.length < count && guard < 4000; guard++) {
    const p = new THREE.Vector2(
      box.min.x + random() * size.x,
      box.min.y + random() * size.y
    );
    if (
      covered(p) &&
      spots.every((q) => q.distanceTo(p) > 0.15) &&
      edgeDistance(rings, p) > margin
    ) {
      spots.push(p);
    }
  }
  return spots;
};

/**
 * Bakes a creation: the dough in its shape with a rounded edge, holes and
 * all, icing on top and sprinkles on the icing – like the cookies in the
 * background. Where the shape is too thin for icing, the sprinkles sit on
 * the dough. Free it with `disposeCookie`.
 */
/**
 * A creation's rings in cookie units: centred, about 2 wide, y up – like the
 * other cookies. Points closer than half a percent of the size are dropped:
 * lighter, looks the same.
 */
const cookieUnits = (dough: Ring[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of dough.flat()) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const scale = 2 / Math.max(maxX - minX, maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return (rings: Ring[]) =>
    rings
      .map((ring) => {
        const points: THREE.Vector2[] = [];
        for (const [x, y] of ring) {
          const p = new THREE.Vector2((x - cx) * scale, (cy - y) * scale);
          const last = points[points.length - 1];
          if (!last || last.distanceTo(p) >= 0.01) points.push(p);
        }
        return points;
      })
      .filter((ring) => ring.length >= 3);
};

/** What bites take from a cookie: its rings cut, and which spots stay. */
type Bitten = {
  cut: (rings: THREE.Vector2[][]) => THREE.Vector2[][];
  keeps: (p: THREE.Vector2) => boolean;
};

export const createShapeCookie = (
  { dough, icing, seed }: CookieShape,
  bitten?: Bitten
) => {
  const random = seeded(Math.max(1, Math.floor(seed) % 2147483646));
  const toCookie = cookieUnits(dough);

  const group = new THREE.Group();
  const { map, bumpMap } = doughTextures();
  const whole = toCookie(dough);
  const body = bitten ? bitten.cut(whole) : whole;
  group.add(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(nest(body), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.045,
        bevelSegments: 6,
      }),
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap,
        bumpScale: 1.4,
        roughness: 0.78,
        sheen: 0.4,
        sheenColor: new THREE.Color("#ffd9a0"),
      })
    )
  );
  const top = DEPTH + 0.1;

  const wholeGlaze = toCookie(icing);
  const glaze = bitten ? bitten.cut(wholeGlaze) : wholeGlaze;
  const icingColor = ICINGS[Math.floor(random() * ICINGS.length)];
  if (glaze.length > 0) {
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(nest(glaze), {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.02,
        bevelSegments: 5,
      }),
      new THREE.MeshPhysicalMaterial({
        color: icingColor,
        roughness: 0.22,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
      })
    );
    mesh.position.z = top - 0.03;
    group.add(mesh);
  }

  const sprinkle = new THREE.CapsuleGeometry(0.022, 0.08, 4, 8);
  const materials = new Map<string, THREE.Material>();
  // Where the whole cookie has them – a bite takes some, the rest stay put.
  const onIcing = wholeGlaze.length > 0;
  for (const p of sprinkleSpots(onIcing ? wholeGlaze : whole, 0.06, random)) {
    let color = SPRINKLES[Math.floor(random() * SPRINKLES.length)];
    if (onIcing && color === icingColor) color = "#2a44ff";
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.35,
        clearcoat: 0.6,
      });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(sprinkle, material);
    mesh.rotation.set(Math.PI / 2, 0, random() * Math.PI);
    mesh.rotateZ(random() * Math.PI);
    mesh.position.set(p.x, p.y, top + (onIcing ? 0.06 : 0.02));
    // Skipped only now – after its random numbers, so the others stay put.
    if (bitten && !bitten.keeps(p)) continue;
    group.add(mesh);
  }
  return group;
};

/**
 * The icing colour a baked creation gets – its seed's first pick, the same
 * as in createShapeCookie.
 */
export const icingColorOf = ({ seed }: CookieShape) =>
  ICINGS[
    Math.floor(
      seeded(Math.max(1, Math.floor(seed) % 2147483646))() * ICINGS.length
    )
  ];

/** A colour from the icings for what the cookie lies on – never white. */
export const glazeColorOf = (shape: CookieShape) => {
  const icing = icingColorOf(shape);
  const colours = ICINGS.filter((colour) => colour !== "#ffffff");
  return icing !== "#ffffff"
    ? icing
    : colours[Math.abs(Math.floor(shape.seed)) % colours.length];
};

/** A bite: round bits (cookie units, the cookie about 2 wide) taken away. */
export type Bite = { x: number; y: number; r: number }[];

/** The creation's outline in cookie units – where bites land. */
export const cookieOutline = ({ dough }: CookieShape) =>
  cookieUnits(dough)(dough);

/** Is there cookie at (x, y) – inside its outline, not bitten away? */
export const cookieAt = (
  outline: THREE.Vector2[][],
  bites: Bite[],
  x: number,
  y: number
) => {
  const p = new THREE.Vector2(x, y);
  return (
    outline.filter((ring) => inside(ring, p)).length % 2 === 1 &&
    !bites
      .flat()
      .some(({ x: bx, y: by, r }) => (x - bx) ** 2 + (y - by) ** 2 < r ** 2)
  );
};

/**
 * A bite right at (x, y) – teeth marks at its sides, turned the way out
 * from the middle.
 */
export const biteAt = (x: number, y: number, r = 0.42): Bite => {
  const length = Math.hypot(x, y);
  const out =
    length > 0.1
      ? new THREE.Vector2(x / length, y / length)
      : new THREE.Vector2(0, 1);
  const side = new THREE.Vector2(-out.y, out.x);
  const tooth = (sign: number) => ({
    x: x + side.x * r * 0.62 * sign + out.x * r * 0.18,
    y: y + side.y * r * 0.62 * sign + out.y * r * 0.18,
    r: r * 0.6,
  });
  return [{ x, y, r }, tooth(1), tooth(-1)];
};

/** Is anything left of the cookie after these bites? Sampled on a grid. */
export const cookieLeft = (outline: THREE.Vector2[][], bites: Bite[]) => {
  for (let x = -1.1; x <= 1.1; x += 0.04) {
    for (let y = -1.1; y <= 1.1; y += 0.04) {
      if (cookieAt(outline, bites, x, y)) return true;
    }
  }
  return false;
};

/**
 * polygon-clipping, loaded on the first bite. Its ESM build has only a
 * default export, its types only named ones.
 */
const clipping = async () => {
  const loaded = await import("polygon-clipping");
  return (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
};

type Clipping = Awaited<ReturnType<typeof clipping>>;

const circlePolygon = ({ x, y, r }: { x: number; y: number; r: number }) => [
  Array.from({ length: 40 }, (_, i): [number, number] => {
    const a = (i / 40) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  }),
];

/** What is left of rings (read even-odd, as nest() does) after the bites. */
const leftOf = (lib: Clipping, rings: THREE.Vector2[][], circles: Bite) => {
  if (rings.length === 0) return [];
  const [first, ...rest] = rings.map((ring) => [
    ring.map((p): [number, number] => [p.x, p.y]),
  ]);
  const whole = lib.xor(first, ...rest);
  return circles.length
    ? lib.difference(whole, ...circles.map(circlePolygon))
    : whole;
};

/** Smaller bits than this (cookie units², the whole about 3) are crumbs. */
const CRUMB_AREA = 0.04;

const ringArea = (ring: [number, number][]) =>
  Math.abs(
    ring.reduce(
      (sum, [x, y], i) =>
        sum +
        x * ring[(i + 1) % ring.length][1] -
        ring[(i + 1) % ring.length][0] * y,
      0
    ) / 2
  );

/**
 * The bits a bite leaves too small to stand on their own: a round bite over
 * each – they are eaten along with it.
 */
export const leftoverCrumbs = async (
  shape: CookieShape,
  bites: Bite[]
): Promise<Bite> => {
  const lib = await clipping();
  return leftOf(lib, cookieOutline(shape), bites.flat())
    .filter(
      ([outer, ...holes]) =>
        ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0) <
        CRUMB_AREA
    )
    .map(([outer]) => {
      const x = outer.reduce((sum, p) => sum + p[0], 0) / outer.length;
      const y = outer.reduce((sum, p) => sum + p[1], 0) / outer.length;
      const r = Math.max(
        ...outer.map(([px, py]) => Math.hypot(px - x, py - y))
      );
      return { x, y, r: r + 0.03 };
    });
};

/**
 * The creation baked as a cookie, bitten: the bites cut out of dough and
 * icing (polygon-clipping, loaded only now), sprinkles in them gone.
 */
export const createBittenCookie = async (shape: CookieShape, bites: Bite[]) => {
  const lib = await clipping();
  const circles = bites.flat();
  const cut = (rings: THREE.Vector2[][]) =>
    circles.length === 0
      ? rings
      : leftOf(lib, rings, circles).flatMap((polygon) =>
          polygon.map((ring) =>
            ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))
          )
        );
  const keeps = (p: THREE.Vector2) =>
    !circles.some(({ x, y, r }) => (p.x - x) ** 2 + (p.y - y) ** 2 < r ** 2);
  return createShapeCookie(shape, { cut, keeps });
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
