import * as THREE from "three";
import { doughLook, doughTextures } from "./dough";

/**
 * Cookies traced from SVGs: the dough from one picture, the icing on top
 * from another – gingerbread man, flower, sun, and any Lucide icon.
 */

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

export const buildSvgCookie = async ({
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
        roughness: doughLook().roughness,
        sheen: 0.4,
        sheenColor: doughLook().sheen,
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

export const GINGERBREAD: SvgCookie = {
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

export const FLOWER: SvgCookie = {
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
export const SUN: SvgCookie = {
  dough: svg(
    `<polygon fill="#000" stroke="#000" stroke-width="0.6" stroke-linejoin="round" points="${burst(16, 11.2, 9.3)}"/>`
  ),
  glaze: svg(
    `<polygon fill="#000" stroke="#000" stroke-width="0.5" stroke-linejoin="round" points="${burst(16, 9.4, 8)}"/>`
  ),
  glazeColor: "#ffc31f",
  depth: 0.12,
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
