import type * as THREE from "three";
import { type Bite, cookieAt } from "../cookies/models";

/** How the cookie on the back lies: tilted back this far (rad). */
export const BACK_TILT = -0.5;

/**
 * Where a click goes through the cookie on the back, in cookie units: the
 * ray from the renderer's camera (28°, at 5.4 – cookies/renderer.ts) met
 * at its top, through its thickness down to its bottom – the cookie lies
 * tilted back by BACK_TILT, so its front edge shows too. `x`, `y`: the
 * click in the canvas's own pixels – the card's lean and turn undone.
 */
const throughCookie = (x: number, y: number, canvas: HTMLCanvasElement) => {
  const u = (x / canvas.offsetWidth) * 2 - 1;
  const v = 1 - (y / canvas.offsetHeight) * 2;
  const spread = Math.tan((14 * Math.PI) / 180);
  // Camera and ray turned into the cookie's own frame (the tilt undone).
  const a = -BACK_TILT;
  const turn = (py: number, pz: number) => [
    py * Math.cos(a) - pz * Math.sin(a),
    py * Math.sin(a) + pz * Math.cos(a),
  ];
  const [oy, oz] = turn(0, 5.4);
  const [dy, dz] = turn(v * spread, -1);
  // The dough's top and bottom (models.ts: DEPTH with its bevel).
  return [0.26, 0.16, 0.06, -0.04, -0.1].map((z) => {
    const t = (z - oz) / dz;
    return { x: u * spread * t, y: oy + dy * t };
  });
};

/**
 * Close to the edge still counts: rings around the click (cookie units) –
 * its rounded, tilted edge shows a little wider than its outline.
 */
const NEAR_EDGE = [0.05, 0.1, 0.16];

/**
 * Where a click on the cookie's area lands on the cookie (cookie units) –
 * the first bit of it along the ray, or the nearest beside it, at its top
 * or at its bottom (the front edge); null beside it or where it is eaten
 * already. `offsetX`, `offsetY`: the click in the area's own frame, the
 * card's lean and turn undone; the canvas sits in it at its layout place.
 */
export const biteSpot = (
  area: HTMLElement,
  offsetX: number,
  offsetY: number,
  outline: THREE.Vector2[][],
  bites: Bite[]
) => {
  const canvas = area.querySelector("canvas");
  if (!canvas) return null;
  const ray = throughCookie(
    offsetX - (canvas.offsetLeft - area.offsetLeft),
    offsetY - (canvas.offsetTop - area.offsetTop),
    canvas
  );
  const around = NEAR_EDGE.flatMap((reach) =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      return [ray[0], ray[ray.length - 1]].map((point) => ({
        x: point.x + Math.cos(angle) * reach,
        y: point.y + Math.sin(angle) * reach,
      }));
    }).flat()
  );
  return (
    [...ray, ...around].find(({ x, y }) => cookieAt(outline, bites, x, y)) ??
    null
  );
};
