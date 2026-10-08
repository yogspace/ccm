/**
 * Crumbs for the card page's cookies (card-cookies.tsx): where a cookie hits
 * something hard – the floor, the card, a button, another cookie – a few
 * bits of dough spring off, fall, hop once more and stay lying. The harder
 * the knock, the more. Too many, and the oldest fade.
 *
 * Plain elements in the cookies' layer, behind the cookies, moved by
 * transform – no React render. Stepped by the cookies' simulation.
 */

type Crumb = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radius (px). */
  r: number;
  spin: number;
  turn: number;
  resting: boolean;
  element: HTMLElement;
};

/** Where crumbs land besides the floor. */
type Ground = { floor: number; width: number; boxes: DOMRect[] };

const GRAVITY = 2600; // px/s² – lighter than a cookie, they float a little
const MAX = 160;
const DOUGH = ["#ecc993", "#dfb072", "#f4dcb0", "#cf9c5e", "#e6bd84"];

export type Crumbs = ReturnType<typeof createCrumbs>;

/** `box`: their own element, first in the cookies' layer – behind them. */
export const createCrumbs = (box: HTMLElement) => {
  let crumbs: Crumb[] = [];

  const draw = (crumb: Crumb) => {
    crumb.element.style.transform = `translate(${crumb.x - crumb.r}px, ${crumb.y - crumb.r}px) rotate(${crumb.turn}rad)`;
  };

  const fade = (crumb: Crumb) => {
    crumb.element
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 })
      .finished.catch(() => undefined)
      .finally(() => crumb.element.remove());
  };

  /** Lands on a surface at height `top`: a small hop, rubbed along. */
  const land = (crumb: Crumb, top: number) => {
    crumb.y = top - crumb.r;
    crumb.vy = -crumb.vy * 0.28;
    crumb.vx *= 0.55;
    crumb.spin *= 0.5;
    if (Math.abs(crumb.vy) < 40) {
      crumb.vy = 0;
      if (Math.abs(crumb.vx) < 25) crumb.resting = true;
    }
  };

  return {
    /**
     * A knock at (x, y): the surface's normal (nx, ny) points the way the
     * crumbs spring; `force` is how hard (px per step, beyond the threshold).
     */
    burst(x: number, y: number, nx: number, ny: number, force: number) {
      const count = Math.max(2, Math.min(8, Math.round(2 + force / 3)));
      for (let i = 0; i < count; i++) {
        // Mostly away from the surface, fanned out to both sides.
        const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.2;
        const speed = (140 + Math.random() * 260) * (1 + force / 20);
        const element = document.createElement("span");
        element.className = "greeting-crumb";
        const r = 1.4 + Math.random() * 2.2;
        element.style.width = `${r * 2}px`;
        element.style.height = `${r * 2 * (0.7 + Math.random() * 0.5)}px`;
        element.style.background =
          DOUGH[Math.floor(Math.random() * DOUGH.length)];
        box.append(element);
        const crumb: Crumb = {
          x: x + (Math.random() - 0.5) * 10,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r,
          spin: (Math.random() - 0.5) * 30,
          turn: Math.random() * Math.PI,
          resting: false,
          element,
        };
        draw(crumb);
        crumbs.push(crumb);
      }
      while (crumbs.length > MAX) {
        const oldest = crumbs.shift();
        if (oldest) fade(oldest);
      }
    },

    /** One step of `dt` seconds. */
    step(dt: number, { floor, width, boxes }: Ground) {
      for (const crumb of crumbs) {
        if (crumb.resting) continue;
        crumb.vy += GRAVITY * dt;
        const fromY = crumb.y;
        crumb.x += crumb.vx * dt;
        crumb.y += crumb.vy * dt;
        crumb.turn += crumb.spin * dt;
        if (crumb.x < crumb.r || crumb.x > width - crumb.r) {
          crumb.x = Math.max(crumb.r, Math.min(width - crumb.r, crumb.x));
          crumb.vx *= -0.3;
        }
        // Onto a box from above – or down to the floor.
        const top = boxes.find(
          (b) =>
            crumb.x > b.left &&
            crumb.x < b.right &&
            fromY + crumb.r <= b.top + 1 &&
            crumb.y + crumb.r > b.top
        )?.top;
        if (top !== undefined && crumb.vy > 0) land(crumb, top);
        else if (crumb.y + crumb.r > floor) land(crumb, floor);
      }
    },

    draw() {
      for (const crumb of crumbs) if (!crumb.resting) draw(crumb);
    },

    /** Still moving – the simulation keeps awake for them. */
    moving: () => crumbs.some((crumb) => !crumb.resting),

    /** Resized: along with the cookies (see card-cookies.tsx). */
    shift(move: (x: number) => number, lifted: number) {
      for (const crumb of crumbs) {
        crumb.x += move(crumb.x);
        crumb.y += lifted;
        // What it lay on may have moved differently: let it settle anew.
        crumb.resting = false;
        draw(crumb);
      }
    },

    clear() {
      for (const crumb of crumbs) crumb.element.remove();
      crumbs = [];
    },

    remove() {
      box.replaceChildren();
      crumbs = [];
    },
  };
};
