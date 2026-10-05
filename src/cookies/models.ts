import * as THREE from "three";

/** Die Keks-Icons der App. */
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

/** Deterministischer Zufall, damit jeder Keks immer gleich aussieht. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

let doughCache: { map: THREE.Texture; bumpMap: THREE.Texture } | undefined;

/** Teig-Textur: Farbschwankungen und gebräunte Sprenkel, dazu eine Bump-Map. */
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

/** Normiert eine Kontur auf Breite/Höhe ≈ 2 um den Ursprung. */
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

/** Rund mit Biss: Punkte in den Bisskreisen auf deren Rand schieben. */
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

/** Stern mit abgerundeten Spitzen. */
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

/** Zufällige, nicht zu dicht liegende Punkte innerhalb der Kontur. */
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

  // Zuckerguss: etwas kleinere Form, glänzend, mit Streuseln.
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

/** Kontur eines SVG (Alpha > 50 %), normiert auf ±1 (viewBox 24, y nach oben). */
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

/** Polygone (Außenring + Löcher) als Three-Shapes. */
const toShapes = (polygons: THREE.Vector2[][][]) =>
  polygons.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(outer);
    shape.holes = holes.map((hole) => new THREE.Path(hole));
    return shape;
  });

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128">${body}</svg>`;

type SvgCookie = {
  /** SVG des Teigs (alles Deckende wird Keks). */
  dough: string;
  /** SVG des Zuckergusses obendrauf. */
  glaze: string;
  glazeColor: string;
  /** Färbt den Teig ein, z. B. dunkler für Lebkuchen. */
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

/** Sternförmiger Kranz um die Mitte (im 24er-Raster der SVGs). */
const burst = (rays: number, outer: number, inner: number) =>
  Array.from({ length: rays * 2 }, (_, i) => {
    const radius = i % 2 ? inner : outer;
    const angle = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

/** Sonne mit gelbem Guss – trägt den Spendenlink. */
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

/** Liefert einen Keks; Geometrien und Materialien werden zwischen Kopien geteilt. */
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

/** Lucide-Icon mit eigener Strichstärke als SVG-Markup. */
const iconMarkup = (icon: SVGSVGElement, strokeWidth: number) => {
  const clone = icon.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "128");
  clone.setAttribute("height", "128");
  clone.setAttribute("stroke", "#000");
  clone.setAttribute("stroke-width", String(strokeWidth));
  return new XMLSerializer().serializeToString(clone);
};

/**
 * Keks in Form eines Icons: die Icon-Linie dick als Teig, darauf dieselbe
 * Linie dünner als Zuckerguss.
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
