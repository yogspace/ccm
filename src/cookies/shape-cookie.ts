import * as THREE from "three";
import type { Ring } from "../geometry/outline";
import {
  DEPTH,
  doughLook,
  doughTextures,
  inside,
  seeded,
  sprinkleColor,
} from "./dough";

/**
 * A cookie in the shape of a creation: its contours like the drawing's (0…1,
 * y down) – the dough and the icing poured on top (see `buildCutter`).
 */
export type CookieShape = {
  dough: Ring[];
  icing: Ring[];
  /** Picks the icing color and where the sprinkles land. */
  seed: number;
  /** The icing's color instead of the seed's pick (a card's favorite). */
  glaze?: string;
  /** Baked of chocolate dough. */
  chocolate?: boolean;
};

/** Mostly white icing, sometimes colored. */
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

/** The creation's outline in cookie units – where bites land. */
export const cookieOutline = ({ dough }: CookieShape) =>
  cookieUnits(dough)(dough);

/** What bites take from a cookie: its rings cut, and which spots stay. */
export type Bitten = {
  cut: (rings: THREE.Vector2[][]) => THREE.Vector2[][];
  keeps: (p: THREE.Vector2) => boolean;
};

/**
 * Bakes a creation: the dough in its shape with a rounded edge, holes and
 * all, icing on top and sprinkles on the icing – like the cookies in the
 * background. Where the shape is too thin for icing, the sprinkles sit on
 * the dough. Bitten (bites.ts), what the bites take is gone. Free it with
 * `disposeCookie`.
 */
export const createShapeCookie = (
  { dough, icing, seed, glaze: chosen, chocolate }: CookieShape,
  bitten?: Bitten
) => {
  const random = seeded(Math.max(1, Math.floor(seed) % 2147483646));
  const toCookie = cookieUnits(dough);

  const group = new THREE.Group();
  const kind = chocolate ? "chocolate" : "plain";
  const { map, bumpMap } = doughTextures(kind);
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
        roughness: doughLook(kind).roughness,
        sheen: 0.4,
        sheenColor: doughLook(kind).sheen,
      })
    )
  );
  const top = DEPTH + 0.1;

  const wholeGlaze = toCookie(icing);
  const glaze = bitten ? bitten.cut(wholeGlaze) : wholeGlaze;
  // Picked even when chosen – the sprinkles' numbers stay the same.
  const picked = ICINGS[Math.floor(random() * ICINGS.length)];
  const icingColor = chosen ?? picked;
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
    const color = sprinkleColor(random, onIcing ? icingColor : undefined);
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
 * The icing color a baked creation gets – its seed's first pick, the same
 * as in createShapeCookie.
 */
export const icingColorOf = ({ seed }: CookieShape) =>
  ICINGS[
    Math.floor(
      seeded(Math.max(1, Math.floor(seed) % 2147483646))() * ICINGS.length
    )
  ];

/** A color from the icings for what the cookie lies on – never white. */
export const glazeColorOf = (shape: CookieShape) => {
  if (shape.glaze) return shape.glaze;
  const icing = icingColorOf(shape);
  const colors = ICINGS.filter((color) => color !== "#ffffff");
  return icing !== "#ffffff"
    ? icing
    : colors[Math.abs(Math.floor(shape.seed)) % colors.length];
};
