import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CookieIcon from "../components/cookie-icon";
import type { CookieShape } from "../cookies/models";
import type { CookieHandle } from "../cookies/renderer";
import { useCardColors } from "../site-context";
import { type Crumbs, createCrumbs } from "./crumbs";

/**
 * The card's own cookies raining down left and right of it – a little physics
 * toy in the background of the card page.
 *
 * The footer's line is the floor.
 * A few big cookies drop in from the top in the empty columns beside the card,
 * one after another – heavy, without a bounce – tip over and lie flat on the
 * floor or on each other. Any cookie can be grabbed: it hangs from the spot
 * where it was taken and swings at the hand while dragged; let go, it flies
 * on with the swing, turns over in the air, knocks against the card, the
 * buttons and the walls and falls again. Their bottoms are heavier: mostly they
 * land icing up. Where one knocks hard against something, it crumbles a
 * little (crumbs.ts). Once everything lies still the simulation sleeps.
 * Each is baked on its own: icing and sprinkles differ.
 *
 * The physics is seen from the side: a cookie is a stick between two points
 * (Verlet integration). Against other cookies it is as thick as it is, against
 * floor, walls, card and buttons as tall as it looks from a little above –
 * so piles lie close and nothing floats. The 3D cookie is turned to match,
 * really, not as a picture: lying it shows its icing, standing its edge,
 * upside down its bottom. Positions go straight to the elements, the turn
 * straight to the renderer – no React render per frame. Where there is no
 * room beside the card (phones), no rain.
 */

/** A point now and one step ago – its speed is the difference. */
type Point = { x: number; y: number; px: number; py: number };
/** Left and right edge (px) of an empty column beside the card. */
type Column = [number, number];
/**
 * The layout the cookies lie in – measured on resize only, so walls, floor
 * and card never shove them mid-frame.
 */
type Scene = {
  width: number;
  floor: number;
  /** What the cookies land on besides the floor: card, buttons, sun. */
  boxes: DOMRect[];
  columns: Column[];
};

type Cookie = {
  /** The stick's ends, edge to edge through the middle of its thickness. */
  a: Point;
  b: Point;
  /** Its canvas (px). */
  size: number;
  /** The stick's length. */
  length: number;
  /** Half its thickness: how close other cookies come. */
  body: number;
  /** Radius of its outline against floor, walls and card … */
  outline: number;
  /** … at these spots along the stick (0: a, 1: b). */
  spots: number[];
  /** Not yet dropped in: waits until this time (ms). */
  dropAt: number;
  held: boolean;
  /** Touched something in the last step – lying, not flying. */
  touched: boolean;
  /** While held: the spot on the stick hanging from the hand (0: a, 1: b) … */
  grip: number;
  /** … where the hand wants it, and where it was at the frame's start. */
  hand: { x: number; y: number };
  handFrom: { x: number; y: number };
  /** Recent hand positions – for the throw. */
  trail: { x: number; y: number; t: number }[];
};

/** A spot on a cookie's stick (0: end a, 1: end b) – null: the world. */
type Contact = { cookie: Cookie; at: number } | null;

/**
 * A hard knock: a cookie hit something at (x, y) – the surface's normal
 * (nx, ny), `force` how far beyond gentle (px per step).
 */
type Knock = (
  cookie: Cookie,
  x: number,
  y: number,
  nx: number,
  ny: number,
  force: number
) => void;

const PER_SIDE = 3;
/**
 * Their canvas (px) – always full size: where the columns are too narrow for
 * it, no cookies at all rather than small ones.
 */
const SIZE = 200;
/** Not all alike: sizes and how each lies turned about its middle. */
const SCALES = [1.08, 0.94, 1, 0.88, 1.04, 0.96];
const ROLLS = [12, -40, 75, 160, -110, 30];
const sizeOf = (i: number) => Math.round(SIZE * SCALES[i]);
/** How far beside the card the rain falls – on wide screens not far off. */
const REACH = 440;
const GRAVITY = 5200; // px/s² – cookies are heavy
const STEP = 1 / 120; // s
/** Rounds of stick and collisions per step – stiffer piles. */
const ROUNDS = 4;
/** Friction: below this share of the press, touching things stick … */
const STICK = 0.9;
/** … above it they slide, held back by this share. */
const SLIDE = 0.5;
/** Air: a little speed lost per step. */
const AIR = 0.999;
/** Air while held: it swings at the hand a few times, then hangs. */
const HELD_AIR = 0.993;
/** The heavier bottom's pull towards icing up (rad/s² on its edge) … */
const KEEL = 30;
/** … and how fast a turn dies down in the air (1/s). */
const SETTLE = 3;
const MAX_THROW = 2600; // px/s
/** Below this speed (px/s) for a while, everything counts as resting. */
const REST = 10;
/** From this speed into something (px per step, ~1100 px/s) it crumbles. */
const KNOCK = 9;
/** How far the camera looks down at the cookies (the renderer's tilt). */
const SIDE_TILT = -1.2;

/**
 * A cookie's measures from its canvas, which it fills to about three
 * quarters. Seen a little from above, lying it looks 0.27 of its width tall
 * below its middle, standing 0.53 – an outline of three round spots along
 * the stick matches both.
 */
const measures = (size: number) => {
  const width = size * 0.76;
  const thickness = width * 0.19;
  const length = width - thickness;
  const reach = (width * 0.26) / length;
  return {
    length,
    body: thickness / 2,
    outline: width * 0.27,
    spots: [0.5 - reach, 0.5, 0.5 + reach],
  };
};

/** The parts of the page the cookies keep to. */
const PARTS = {
  stage: '[data-part="stage"]',
  card: '[data-part="card"]',
  actions: '[data-part="actions"]',
  cta: '[data-part="cta"]',
  footer: "[data-greeting] > footer",
  sun: "[data-greeting] [data-donate]",
};

/**
 * Where an element lies in the layer – by its place in the layout, not as
 * drawn: rising in and the card leaning to the pointer don't count.
 */
const place = (selector: string, layer: HTMLElement) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = element;
  while (node && node !== layer.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return new DOMRect(x, y, element.offsetWidth, element.offsetHeight);
};

/**
 * Floor, boxes and columns from the layout – null without room. The floor
 * is the footer's line; the cookies fall beside the card and the buttons and
 * land on the floor, on the buttons or on the sun.
 */
const measure = (layer: HTMLElement): Scene | null => {
  const [stage, card, actions, cta, footer, sun] = Object.values(PARTS).map(
    (part) => place(part, layer)
  );
  if (!(stage && footer)) return null;
  const width = layer.clientWidth;
  const middle = [stage, actions, cta].filter((box) => box !== null);
  const left = Math.min(...middle.map((box) => box.left));
  const right = Math.max(...middle.map((box) => box.right));
  const narrowest = Math.min(left, width - right);
  if (narrowest < SIZE * 0.85) return null;
  return {
    width,
    floor: footer.top,
    boxes: [card, actions, cta, sun].filter((box) => box !== null),
    columns: [
      [Math.max(0, left - REACH), left],
      [right, Math.min(width, right + REACH)],
    ],
  };
};

const angleOf = ({ a, b }: Cookie) => Math.atan2(b.y - a.y, b.x - a.x);

/** How easily a contact's spot moves – the world not at all. */
const ease = (contact: Contact) =>
  contact ? (1 - contact.at) ** 2 + contact.at ** 2 : 0;

/** Each end of the contact's stick with its share of the spot. */
const ends = (contact: Contact, act: (p: Point, share: number) => void) => {
  if (!contact) return;
  act(contact.cookie.a, 1 - contact.at);
  act(contact.cookie.b, contact.at);
};

/** How far a contact's spot moved this step – the world stays put. */
const movedAt = (contact: Contact) => {
  if (!contact) return { x: 0, y: 0 };
  const { a, b } = contact.cookie;
  const at = contact.at;
  return {
    x: (a.x - a.px) * (1 - at) + (b.x - b.px) * at,
    y: (a.y - a.py) * (1 - at) + (b.y - b.py) * at,
  };
};

/**
 * Two things touching – a spot on a cookie and one on another, or the world
 * (null) – along the normal (nx, ny) from two to one, `depth` too close:
 * pushed apart, and how far they slid along each other this step taken back
 * – all of it while that is little next to how hard they press (they stick),
 * else part of it. Moving positions, not speeds, so it holds piles still and
 * never flings anything; no bounce – cookies are heavy. Shared by how easily
 * each moves: the world not at all.
 */
const resolve = (
  one: Contact,
  two: Contact,
  nx: number,
  ny: number,
  depth: number
) => {
  const total = ease(one) + ease(two);
  if (total === 0) return;
  if (one) one.cookie.touched = true;
  if (two) two.cookie.touched = true;
  const first = movedAt(one);
  const second = movedAt(two);
  const along = (second.x - first.x) * ny + (first.y - second.y) * nx;
  const slide = Math.abs(along);
  const back =
    slide < depth * STICK
      ? along
      : along * Math.min(1, (depth * SLIDE) / slide);
  // Apart along the normal, back along the surface (-ny, nx).
  const dx = (nx * depth + ny * back) / total;
  const dy = (ny * depth - nx * back) / total;
  ends(one, (p, share) => {
    p.x += dx * share;
    p.y += dy * share;
  });
  ends(two, (p, share) => {
    p.x -= dx * share;
    p.y -= dy * share;
  });
};

/**
 * The bottom is heavier than the icing: the cookie turns icing up – in the
 * air before it lands, and on its edge it topples that way. In the air its
 * turn dies down too, so it settles instead of spinning on.
 */
const right = (cookie: Cookie) => {
  const { a, b } = cookie;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy || 1e-6;
  // Its turn this step (rad), and how far it lies from icing up.
  const spin =
    (dx * (b.y - b.py - (a.y - a.py)) - dy * (b.x - b.px - (a.x - a.px))) /
    span;
  const tilt = dy / Math.sqrt(span);
  const turn =
    -KEEL * STEP * STEP * tilt - (cookie.touched ? 0 : SETTLE * STEP * spin);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  for (const p of [a, b]) {
    const rx = p.x - mx;
    const ry = p.y - my;
    p.x -= turn * ry;
    p.y += turn * rx;
  }
};

/** Keeps the stick at its length, both ends moving half the way. */
const keep = ({ a, b, length }: Cookie) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1e-6;
  const shift = ((distance - length) / distance) * 0.5;
  a.x += dx * shift;
  a.y += dy * shift;
  b.x -= dx * shift;
  b.y -= dy * shift;
};

/**
 * Pulls the held spot to the hand – the ends by their share, so the rest
 * hangs from it and swings: held at its edge the cookie dangles, held in the
 * middle it stays level.
 */
const hang = (cookie: Cookie, x: number, y: number) => {
  const { a, b, grip } = cookie;
  const dx = x - (a.x + (b.x - a.x) * grip);
  const dy = y - (a.y + (b.y - a.y) * grip);
  const total = (1 - grip) ** 2 + grip ** 2;
  a.x += (dx * (1 - grip)) / total;
  a.y += (dy * (1 - grip)) / total;
  b.x += (dx * grip) / total;
  b.y += (dy * grip) / total;
};

/** The ends of one cookie against the stick of another. */
const touchEnds = (one: Cookie, two: Cookie, knock?: Knock) => {
  const reach = one.body + two.body;
  const dx = two.b.x - two.a.x;
  const dy = two.b.y - two.a.y;
  const span = dx * dx + dy * dy || 1e-6;
  for (const [end, at] of [
    [one.a, 0],
    [one.b, 1],
  ] as const) {
    const t = Math.max(
      0,
      Math.min(1, ((end.x - two.a.x) * dx + (end.y - two.a.y) * dy) / span)
    );
    let nx = end.x - (two.a.x + dx * t);
    let ny = end.y - (two.a.y + dy * t);
    const distance = Math.hypot(nx, ny);
    if (distance >= reach) continue;
    if (distance < 1e-6) {
      // Right on the stick: out to the side facing up.
      const across = Math.sqrt(span);
      nx = dy / across;
      ny = -dx / across;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
    } else {
      nx /= distance;
      ny /= distance;
    }
    if (knock) {
      const first = movedAt({ cookie: one, at });
      const second = movedAt({ cookie: two, at: t });
      const into = (second.x - first.x) * nx + (second.y - first.y) * ny;
      if (into > KNOCK) knock(one, end.x, end.y, nx, ny, into - KNOCK);
    }
    resolve(
      { cookie: one, at },
      { cookie: two, at: t },
      nx,
      ny,
      reach - distance
    );
  }
};

/** The outline's spots against floor, walls and boxes. */
const touchWorld = (
  cookie: Cookie,
  floor: number,
  width: number,
  boxes: DOMRect[],
  knock?: Knock
) => {
  const { a, b, outline } = cookie;
  for (const at of cookie.spots) {
    const contact = { cookie, at };
    const x = a.x + (b.x - a.x) * at;
    const y = a.y + (b.y - a.y) * at;
    /** Against a surface at (sx, sy): how hard it came, then pushed out. */
    const hit = (
      sx: number,
      sy: number,
      nx: number,
      ny: number,
      depth: number
    ) => {
      if (knock) {
        const moved = movedAt(contact);
        const into = -(moved.x * nx + moved.y * ny);
        if (into > KNOCK) knock(cookie, sx, sy, nx, ny, into - KNOCK);
      }
      resolve(contact, null, nx, ny, depth);
    };
    if (y > floor - outline) hit(x, floor, 0, -1, y - floor + outline);
    if (x < outline) hit(0, y, 1, 0, outline - x);
    else if (x > width - outline) hit(width, y, -1, 0, x - width + outline);
    for (const box of boxes) {
      // Inside: out over the top.
      if (x > box.left && x < box.right && y > box.top && y < box.bottom) {
        hit(x, box.top, 0, -1, y - box.top + outline);
        continue;
      }
      const cx = Math.max(box.left, Math.min(box.right, x));
      const cy = Math.max(box.top, Math.min(box.bottom, y));
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < outline && distance > 1e-6) {
        hit(
          cx,
          cy,
          (x - cx) / distance,
          (y - cy) / distance,
          outline - distance
        );
      }
    }
  }
};

const CardCookies = ({ shape }: { shape: CookieShape }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const crumbBoxRef = useRef<HTMLDivElement>(null);
  const crumbs = useRef<Crumbs | null>(null);
  const cookieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const handles = useRef<(CookieHandle | null)[]>([]);
  const cookies = useRef<Cookie[]>([]);
  /** The layout the cookies lie in – till the next resize. */
  const laidIn = useRef<Scene | null>(null);
  const wake = useRef<() => void>(() => undefined);
  const [scene, setScene] = useState<Scene | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const count = scene ? PER_SIDE * 2 : 0;
  // Each baked on its own – its own sprinkles, its icing in one of the
  // favourite colours (CMS), picked at random; plain and chocolate mixed.
  const colors = useCardColors();
  const shapes = useMemo(
    () =>
      SCALES.map((_, i) => ({
        ...shape,
        seed: shape.seed + i * 7919,
        glaze: colors[Math.floor(Math.random() * colors.length)]?.color,
        chocolate: Math.random() < 0.4,
      })),
    [shape, colors]
  );

  // The crumbs live as long as the page.
  useEffect(() => {
    const box = crumbBoxRef.current;
    if (!box) return;
    crumbs.current = createCrumbs(box);
    return () => {
      crumbs.current?.remove();
      crumbs.current = null;
    };
  }, []);

  // Measure, and again whenever the page or its parts change size: the floor
  // moves, the cookies ride along.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setScene(measure(layer));
    };
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(update);
    });
    observer.observe(layer);
    for (const part of Object.values(PARTS)) {
      const element = document.querySelector(part);
      if (element) observer.observe(element);
    }
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // The simulation – started once there is room.
  useEffect(() => {
    const layer = layerRef.current;
    // No room: gone – back again, a fresh rain.
    if (!scene) {
      cookies.current = [];
      crumbs.current?.clear();
    }
    if (!(layer && scene)) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const now = performance.now();
    const { width, floor, boxes, columns } = scene;
    const fall = GRAVITY * STEP * STEP;

    // Resized: the cookies ride along, without being flung – the right
    // side's with the right edge, the middle's half as far, the left side's
    // stay; all up or down with the floor.
    const before = laidIn.current;
    if (before) {
      const third = before.width / 3;
      const grown = width - before.width;
      const lifted = floor - before.floor;
      const moveOf = (x: number) =>
        x < third ? 0 : x > third * 2 ? grown : grown / 2;
      crumbs.current?.shift(moveOf, lifted);
      for (const cookie of cookies.current) {
        const x = (cookie.a.x + cookie.b.x) / 2;
        const shift = moveOf(x);
        for (const p of [cookie.a, cookie.b]) {
          p.x += shift;
          p.px += shift;
          p.y += lifted;
          p.py += lifted;
        }
        cookie.hand = { x: cookie.hand.x + shift, y: cookie.hand.y + lifted };
        cookie.handFrom = cookie.hand;
      }
    }
    laidIn.current = scene;

    // Above the screen, left and right by turns, each at its own slant.
    if (cookies.current.length !== count) {
      cookies.current = Array.from({ length: count }, (_, i) => {
        const size = sizeOf(i);
        const shape = measures(size);
        const [from, to] = columns[i % 2];
        const margin = size * 0.45;
        const x =
          to - from > margin * 2
            ? from + margin + Math.random() * (to - from - margin * 2)
            : (from + to) / 2;
        const y = -size / 2;
        const angle = (Math.random() - 0.5) * 1.4;
        const half = shape.length / 2;
        const end = (sign: number): Point => {
          const px = x + Math.cos(angle) * half * sign;
          const py = y + Math.sin(angle) * half * sign;
          return { x: px, y: py, px, py };
        };
        return {
          ...shape,
          a: end(-1),
          b: end(1),
          size,
          dropAt: now + 500 + i * 380 + Math.random() * 160,
          held: false,
          touched: false,
          grip: 0.5,
          hand: { x, y },
          handFrom: { x, y },
          trail: [],
        };
      });
    }

    let restingFor = 0;
    let last = now;
    /** Time not yet simulated (s) – less than a step. */
    let owed = 0;
    let frame = 0;
    let running = false;

    /** `along`: how far into this frame's hand movement (0…1) the step is. */
    const step = (time: number, along: number) => {
      const live = cookies.current.filter((cookie) => time >= cookie.dropAt);
      // A hard knock crumbles – once per cookie and step, not when still.
      const knocked = new Set<Cookie>();
      const knock: Knock | undefined = still
        ? undefined
        : (cookie, x, y, nx, ny, force) => {
            if (knocked.has(cookie)) return;
            knocked.add(cookie);
            crumbs.current?.burst(x, y, nx, ny, force);
          };
      for (const cookie of live) {
        if (!cookie.held) right(cookie);
        cookie.touched = false;
        const air = cookie.held ? HELD_AIR : AIR;
        for (const p of [cookie.a, cookie.b]) {
          let vx = (p.x - p.px) * air;
          let vy = (p.y - p.py) * air + fall;
          // Never faster than a cookie is thick – nothing passes through.
          const speed = Math.hypot(vx, vy);
          const limit = cookie.body * 1.8;
          if (speed > limit) {
            vx *= limit / speed;
            vy *= limit / speed;
          }
          p.px = p.x;
          p.py = p.y;
          p.x += vx;
          p.y += vy;
        }
      }
      for (let round = 0; round < ROUNDS; round++) {
        // Knocks are told in the first round – before they are pushed out.
        const told = round === 0 ? knock : undefined;
        for (const cookie of live) keep(cookie);
        for (let i = 0; i < live.length; i++) {
          for (let j = i + 1; j < live.length; j++) {
            touchEnds(live[i], live[j], told);
            touchEnds(live[j], live[i], told);
          }
        }
        for (const cookie of live) {
          touchWorld(cookie, floor, width, boxes, told);
        }
        // The hand has the last word.
        for (const cookie of live) {
          if (!cookie.held) continue;
          const { hand, handFrom } = cookie;
          hang(
            cookie,
            handFrom.x + (hand.x - handFrom.x) * along,
            handFrom.y + (hand.y - handFrom.y) * along
          );
        }
      }
      crumbs.current?.step(STEP, scene);
    };

    const draw = () => {
      cookies.current.forEach((cookie, i) => {
        const element = cookieRefs.current[i];
        if (!element) return;
        const x = (cookie.a.x + cookie.b.x) / 2;
        const y = (cookie.a.y + cookie.b.y) / 2;
        element.style.transform = `translate(${x - cookie.size / 2}px, ${y - cookie.size / 2}px)`;
        element.style.visibility = y > -cookie.size / 2 ? "visible" : "hidden";
        handles.current[i]?.setSide(angleOf(cookie));
      });
      crumbs.current?.draw();
    };

    const tick = (time: number) => {
      // Fixed steps; after a hitch (a resize, a busy tab) no more than a
      // twentieth of a second caught up – slower, never a jump. The hand's
      // movement spread over them, so a swing stays smooth.
      owed = Math.min(0.05, owed + (time - last) / 1000);
      last = time;
      const steps = Math.floor(owed / STEP);
      owed -= steps * STEP;
      for (let k = 1; k <= steps; k++) {
        step(time, k / steps);
      }
      if (steps > 0) {
        for (const cookie of cookies.current) cookie.handFrom = cookie.hand;
      }
      draw();
      const moving =
        crumbs.current?.moving() ||
        cookies.current.some(
          (cookie) =>
            cookie.held ||
            time < cookie.dropAt ||
            [cookie.a, cookie.b].some(
              (p) => Math.hypot(p.x - p.px, p.y - p.py) / STEP > REST
            )
        );
      restingFor = moving ? 0 : restingFor + 1;
      // Asleep after half a second of stillness – until woken.
      if (restingFor > 30) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    wake.current = () => {
      restingFor = 0;
      if (running) return;
      running = true;
      last = performance.now();
      owed = 0;
      frame = requestAnimationFrame(tick);
    };

    if (still) {
      // No falling: settle them at once, then show them lying there.
      for (const cookie of cookies.current) cookie.dropAt = 0;
      for (let i = 0; i < 900; i++) step(now, 1);
      draw();
    } else {
      wake.current();
    }
    return () => {
      cancelAnimationFrame(frame);
      running = false;
    };
  }, [scene, count]);

  // Grab, swing, throw.
  const grab =
    (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const cookie = cookies.current[index];
      const layer = layerRef.current;
      if (!(cookie && layer)) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      const at = (pointer: { clientX: number; clientY: number }) => {
        const origin = layer.getBoundingClientRect();
        return {
          x: pointer.clientX - origin.left,
          y: pointer.clientY - origin.top,
        };
      };
      // The spot on the stick nearest the hand hangs from it – as far from the
      // hand as it was taken, so nothing jumps.
      const { a, b } = cookie;
      const pointer = at(event);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      cookie.grip = Math.max(
        0,
        Math.min(
          1,
          ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) /
            (dx * dx + dy * dy || 1e-6)
        )
      );
      const spot = { x: a.x + dx * cookie.grip, y: a.y + dy * cookie.grip };
      const offset = { x: pointer.x - spot.x, y: pointer.y - spot.y };
      cookie.hand = spot;
      cookie.handFrom = spot;
      cookie.trail = [{ ...spot, t: performance.now() }];
      cookie.held = true;
      setHeld(index);
      wake.current();

      const move = (moved: PointerEvent) => {
        const { x, y } = at(moved);
        cookie.hand = { x: x - offset.x, y: y - offset.y };
        cookie.trail = [
          ...cookie.trail.slice(-5),
          { ...cookie.hand, t: performance.now() },
        ];
        wake.current();
      };
      const release = () => {
        // Flies on as the hand last moved – turning as it swung.
        const now = performance.now();
        const recent = cookie.trail.filter((entry) => now - entry.t < 100);
        const first = recent[0];
        const end = recent[recent.length - 1];
        const seconds = first && end ? (end.t - first.t) / 1000 : 0;
        if (first && end && seconds > 0.01) {
          const clamp = (v: number) =>
            Math.max(-MAX_THROW, Math.min(MAX_THROW, v));
          const vx = clamp((end.x - first.x) / seconds) * STEP;
          const vy = clamp((end.y - first.y) / seconds) * STEP;
          const moved = movedAt({ cookie, at: cookie.grip });
          for (const p of [cookie.a, cookie.b]) {
            p.px -= vx - moved.x;
            p.py -= vy - moved.y;
          }
        }
        cookie.held = false;
        setHeld(null);
        wake.current();
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", release);
        target.removeEventListener("pointercancel", release);
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", release);
      target.addEventListener("pointercancel", release);
    };

  // No stacking context of its own: each cookie lies behind the content by
  // itself – and the one being dragged can float above everything.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      ref={layerRef}
    >
      {/* First: the crumbs lie behind every cookie (crumbs.ts), moved by
          transform from the corner. */}
      <div
        className="pointer-events-none absolute inset-0 -z-1"
        ref={crumbBoxRef}
      />
      {Array.from({ length: count }, (_, i) => (
        // Positioned by the physics (transform), so they start at the corner.
        <div
          className="pointer-events-auto absolute top-0 left-0 -z-1 cursor-grab touch-none select-none will-change-transform data-held:z-5 data-held:cursor-grabbing"
          data-held={held === i || undefined}
          key={i}
          onPointerDown={grab(i)}
          ref={(element) => {
            cookieRefs.current[i] = element;
          }}
          style={{ visibility: "hidden" }}
        >
          <CookieIcon
            grown
            idle={false}
            interactive={false}
            onHandle={(handle) => {
              handles.current[i] = handle;
              const cookie = cookies.current[i];
              if (handle && cookie) handle.setSide(angleOf(cookie));
            }}
            roll={ROLLS[i]}
            shape={shapes[i]}
            side
            size={sizeOf(i)}
            tilt={SIDE_TILT}
          />
        </div>
      ))}
    </div>
  );
};

export default memo(CardCookies);
