import { type Column, type Scene, SIZE } from "./cookie-scene";

/**
 * The physics of the cookies raining down beside the card (card-cookies.tsx),
 * seen from the side: a cookie is a stick between two points (Verlet
 * integration). Against other cookies it is as thick as it is, against
 * floor, walls, card and buttons as tall as it looks from a little above –
 * so piles lie close and nothing floats.
 */

/** A point now and one step ago – its speed is the difference. */
type Point = { x: number; y: number; px: number; py: number };

export type Cookie = {
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
export type Knock = (
  cookie: Cookie,
  x: number,
  y: number,
  nx: number,
  ny: number,
  force: number
) => void;

export const PER_SIDE = 3;
/** Not all alike: sizes … */
export const SCALES = [1.08, 0.94, 1, 0.88, 1.04, 0.96];
export const sizeOf = (i: number) => Math.round(SIZE * SCALES[i]);
const GRAVITY = 5200; // px/s² – cookies are heavy
export const STEP = 1 / 120; // s
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

/**
 * The `i`th cookie, above the screen – left and right by turns, each at its
 * own slant – dropping in from `now` on, one after another.
 */
export const spawn = (i: number, columns: Column[], now: number): Cookie => {
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
};

export const angleOf = ({ a, b }: Cookie) => Math.atan2(b.y - a.y, b.x - a.x);

/** Moved along with the page: its ends and its hand. */
export const shift = (cookie: Cookie, dx: number, dy: number) => {
  for (const p of [cookie.a, cookie.b]) {
    p.x += dx;
    p.px += dx;
    p.y += dy;
    p.py += dy;
  }
  cookie.hand = { x: cookie.hand.x + dx, y: cookie.hand.y + dy };
  cookie.handFrom = cookie.hand;
};

/** Still on its way – held, not dropped in yet, or moving. */
export const busy = (cookie: Cookie, time: number) =>
  cookie.held ||
  time < cookie.dropAt ||
  [cookie.a, cookie.b].some(
    (p) => Math.hypot(p.x - p.px, p.y - p.py) / STEP > REST
  );

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
  { floor, width, boxes }: Scene,
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

/**
 * One step for the cookies that have dropped in: they turn icing up, fall,
 * keep their length, push each other and the world apart; held ones hang
 * from the hand – `along`: how far into this frame's hand movement (0…1)
 * the step is. Hard knocks are told to `knock`.
 */
export const simulate = (
  live: Cookie[],
  scene: Scene,
  along: number,
  knock?: Knock
) => {
  const fall = GRAVITY * STEP * STEP;
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
    for (const cookie of live) touchWorld(cookie, scene, told);
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
};

/**
 * Taken at (x, y): the spot on its stick nearest the hand hangs from it.
 * Returns that spot.
 */
export const take = (cookie: Cookie, x: number, y: number) => {
  const { a, b } = cookie;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  cookie.grip = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1e-6))
  );
  const spot = { x: a.x + dx * cookie.grip, y: a.y + dy * cookie.grip };
  cookie.hand = spot;
  cookie.handFrom = spot;
  cookie.trail = [{ ...spot, t: performance.now() }];
  cookie.held = true;
  return spot;
};

/** The hand moved: the held spot follows. */
export const pull = (cookie: Cookie, x: number, y: number) => {
  cookie.hand = { x, y };
  cookie.trail = [...cookie.trail.slice(-5), { x, y, t: performance.now() }];
};

/** Let go: it flies on as the hand last moved – turning as it swung. */
export const letGo = (cookie: Cookie) => {
  const now = performance.now();
  const recent = cookie.trail.filter((entry) => now - entry.t < 100);
  const first = recent[0];
  const end = recent[recent.length - 1];
  const seconds = first && end ? (end.t - first.t) / 1000 : 0;
  if (first && end && seconds > 0.01) {
    const clamp = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v));
    const vx = clamp((end.x - first.x) / seconds) * STEP;
    const vy = clamp((end.y - first.y) / seconds) * STEP;
    const moved = movedAt({ cookie, at: cookie.grip });
    for (const p of [cookie.a, cookie.b]) {
      p.px -= vx - moved.x;
      p.py -= vy - moved.y;
    }
  }
  cookie.held = false;
};
