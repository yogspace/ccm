import * as THREE from "three";
import {
  BEVEL,
  chocolateColor,
  DEPTH,
  doughLook,
  doughTextures,
  inside,
  seeded,
  sprinkleColor,
  TOP,
} from "./dough";
import { buildSvgCookie, FLOWER, GINGERBREAD, SUN } from "./svg-cookies";

/** The app's cookie icons. */
export type CookieKind =
  | "bite"
  | "chip"
  | "heart"
  | "star"
  | "flower"
  | "gingerbread"
  | "sun";

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

/** A cookie from an outline: chocolate chips, or icing with sprinkles. */
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
        roughness: doughLook().roughness,
        sheen: 0.4,
        sheenColor: doughLook().sheen,
      })
    )
  );

  if (kind === "chip" || kind === "bite") {
    const chocolate = new THREE.MeshPhysicalMaterial({
      color: chocolateColor(),
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
    const mesh = new THREE.Mesh(
      sprinkle,
      new THREE.MeshPhysicalMaterial({
        color: sprinkleColor(random, icingColor),
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

const cache = new Map<CookieKind, Promise<THREE.Group>>();

/** Returns a cookie; geometries and materials are shared between copies. */
/** Bakes every kind anew – its colors changed (the admin's preview). */
export const forgetKinds = () => cache.clear();

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
