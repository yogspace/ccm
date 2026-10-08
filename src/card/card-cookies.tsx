import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CookieIcon from "../components/cookie-icon";
import type { CookieHandle } from "../cookies/renderer";
import type { CookieShape } from "../cookies/shape-cookie";
import { useCardColors } from "../site-context";
import {
  angleOf,
  busy,
  type Cookie,
  type Knock,
  letGo,
  PER_SIDE,
  pull,
  SCALES,
  STEP,
  shift,
  simulate,
  sizeOf,
  spawn,
  take,
} from "./cookie-physics";
import { measure, PARTS, type Scene } from "./cookie-scene";
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
 * The physics is seen from the side (cookie-physics.ts), the page measured
 * for it on resize (cookie-scene.ts). The 3D cookie is turned to match,
 * really, not as a picture: lying it shows its icing, standing its edge,
 * upside down its bottom. Positions go straight to the elements, the turn
 * straight to the renderer – no React render per frame. Where there is no
 * room beside the card (phones), no rain.
 */

/** How each lies turned about its middle. */
const ROLLS = [12, -40, 75, 160, -110, 30];
/** How far the camera looks down at the cookies (the renderer's tilt). */
const SIDE_TILT = -1.2;

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
  // favorite colors (CMS), picked at random; plain and chocolate mixed.
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
    const { width, floor, columns } = scene;

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
        shift(cookie, moveOf((cookie.a.x + cookie.b.x) / 2), lifted);
      }
    }
    laidIn.current = scene;

    // Above the screen, left and right by turns, each at its own slant.
    if (cookies.current.length !== count) {
      cookies.current = Array.from({ length: count }, (_, i) =>
        spawn(i, columns, now)
      );
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
      simulate(live, scene, along, knock);
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
        cookies.current.some((cookie) => busy(cookie, time));
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
      const pointer = at(event);
      const spot = take(cookie, pointer.x, pointer.y);
      const offset = { x: pointer.x - spot.x, y: pointer.y - spot.y };
      setHeld(index);
      wake.current();

      const move = (moved: PointerEvent) => {
        const { x, y } = at(moved);
        pull(cookie, x - offset.x, y - offset.y);
        wake.current();
      };
      const release = () => {
        letGo(cookie);
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
