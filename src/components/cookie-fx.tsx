import { animate } from "motion/react";
import { type CSSProperties, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { CookieShape } from "../cookies/models";
import CookieIcon from "./cookie-icon";

/** The size the flying cookie is drawn at – the bar's tile size. */
const FLIGHT_SIZE = 92;

type Point = { x: number; y: number };

const centerOf = (rect: DOMRect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/**
 * A cookie flying from its button into its place in the bar – along an arc,
 * turning once, growing from the button's size to the tile's. The target is
 * measured on every frame: the bar may still be sliding in, or the list
 * scrolling to the start.
 *
 * In <body>, not in the dock: the dock is moved with `translate`, and a
 * fixed element inside it would move along.
 */
export const CookieFlight = ({
  from,
  shape,
  target,
  onLand,
}: {
  from: DOMRect;
  shape: CookieShape;
  /** Where it lands right now (viewport), or null if the place is gone. */
  target: () => Point | null;
  onLand: (at: Point) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const start = centerOf(from);
    const startScale = Math.max(from.width, 24) / FLIGHT_SIZE;
    let last = start;
    // Higher arcs for longer ways – a hop for a short one.
    const controls = animate(0, 1, {
      duration: 0.85,
      ease: [0.5, 0, 0.25, 1],
      onUpdate: (t) => {
        const end = targetRef.current() ?? last;
        last = end;
        const lift = Math.min(
          220,
          Math.hypot(end.x - start.x, end.y - start.y) * 0.35
        );
        const x = start.x + (end.x - start.x) * t;
        const y =
          start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * lift;
        const scale = startScale + (1 - startScale) * t;
        element.style.transform = `translate(${x - FLIGHT_SIZE / 2}px, ${y - FLIGHT_SIZE / 2}px) scale(${scale}) rotate(${t * 360}deg)`;
      },
      onComplete: () => onLandRef.current(last),
    });
    return () => controls.stop();
  }, [from]);

  // Above everything, until it has landed.
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-200 drop-shadow-[0_0.8rem_1rem_rgb(4_8_60/0.35)] will-change-transform"
      ref={ref}
    >
      <CookieIcon
        grown
        idle={false}
        interactive={false}
        shape={shape}
        size={FLIGHT_SIZE}
        tilt={-0.35}
      />
    </div>,
    document.body
  );
};

const CRUMB_COLOURS = ["#d9a35b", "#b8773c", "#f2c98a", "#ff5fa8", "#2a44ff"];

/**
 * A handful of crumbs bursting from a point – when a cookie lands in the bar
 * or is eaten. Gone after half a second; `seed` makes every burst different.
 */
export const Crumbs = ({ at, seed }: { at: Point; seed: number }) => {
  const crumbs = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2 + ((seed * 7 + i * 13) % 10) / 10;
        const distance = 26 + ((seed * 3 + i * 17) % 22);
        return {
          dx: Math.cos(angle) * distance,
          // A little more upwards – crumbs jump before they fall.
          dy: Math.sin(angle) * distance - 10,
          size: 4 + ((seed + i * 5) % 4),
          colour: CRUMB_COLOURS[(seed + i) % CRUMB_COLOURS.length],
          delay: (i % 3) * 25,
        };
      }),
    [seed]
  );
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed z-201 size-0"
      style={{ left: at.x, top: at.y } as CSSProperties}
    >
      {crumbs.map((crumb) => (
        <span
          className="absolute top-0 left-0 animate-[crumb_0.6s_cubic-bezier(0.2,0.7,0.4,1)_both] rounded-[40%]"
          key={`${crumb.dx}-${crumb.dy}`}
          style={
            {
              "--dx": `${crumb.dx}px`,
              "--dy": `${crumb.dy}px`,
              width: crumb.size,
              height: crumb.size,
              background: crumb.colour,
              animationDelay: `${crumb.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body
  );
};
