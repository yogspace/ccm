import type { CSSProperties } from "react";
import { cn } from "../cn";
import { still } from "./card-link";

/**
 * A sprinkle bursting from behind the card, turned by --angle, flying out to
 * --reach, in --color, after --delay.
 */
const sprinkle =
  "absolute top-1/2 left-1/2 h-[0.95cqw] w-[2.4cqw] animate-[greet-sprinkle_1.4s_var(--ease-soft)_var(--delay,0.7s)_both] rounded-[1cqw] bg-(--color) opacity-0";

const SPRINKLES = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * 360 + (i % 2 ? 11 : -7),
  color: ["#ff5fa8", "#ffffff", "#ffc31f", "#ff6a1f", "#5fb36b"][i % 5],
  reach: 34 + (i % 3) * 5,
}));

const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  angle: (i / 40) * 360 + ((i * 37) % 17) - 8,
  color: ["#ff5fa8", "#ffffff", "#ffc31f", "#ff6a1f", "#5fb36b", "#a9b6ff"][
    i % 6
  ],
  reach: 52 + ((i * 53) % 34),
  delay: ((i * 29) % 12) * 0.02,
  size: 0.8 + ((i * 31) % 7) / 10,
}));

/**
 * A few sprinkles that burst out from behind the card – as it lands, and
 * again on every turn (`turns`).
 */
export const Sprinkles = ({ turns }: { turns: number }) =>
  still()
    ? null
    : SPRINKLES.map(({ angle, color, reach }) => (
        <i
          aria-hidden
          className={sprinkle}
          key={`${turns}-${angle}`}
          style={
            {
              "--angle": `${angle}deg`,
              "--color": color,
              "--reach": `${reach}cqw`,
              "--delay": turns === 0 ? "0.7s" : "0.3s",
            } as CSSProperties
          }
        />
      ));

/**
 * The cookie eaten up: confetti from behind the card – like the sprinkles,
 * but more of it, flying farther, a little apart in time, then drifting
 * down as it fades.
 */
export const Confetti = () =>
  still()
    ? null
    : CONFETTI.map(({ angle, color, reach, delay, size }) => (
        <i
          aria-hidden
          className={cn(
            sprinkle,
            "h-[calc(0.95cqw*var(--size,1))] w-[calc(2.4cqw*var(--size,1))] animate-[greet-confetti_2.4s_cubic-bezier(0.12,0.7,0.3,1)_var(--delay,0s)_both]"
          )}
          key={`eaten-${angle}`}
          style={
            {
              "--angle": `${angle}deg`,
              "--color": color,
              "--reach": `${reach}cqw`,
              "--delay": `${delay}s`,
              "--size": size,
            } as CSSProperties
          }
        />
      ));
