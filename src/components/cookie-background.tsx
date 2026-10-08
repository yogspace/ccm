import {
  Anchor,
  Cake,
  Cat,
  Crown,
  Gift,
  Heart,
  type LucideIcon,
  Moon,
  Music,
  Pencil,
  Rocket,
  Ruler,
  Scissors,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import type { CookieKind } from "../cookies/kinds";
import CookieIcon from "./cookie-icon";

/**
 * Without the bitten cookie – reserved for the logo – and without the
 * chocolate chip one: that one belongs to the UI (slider thumbs, cookie jar,
 * “save as cookie”).
 */
const KINDS: CookieKind[] = ["heart", "star", "flower", "gingerbread"];
const ICONS: LucideIcon[] = [
  Anchor,
  Cake,
  Cat,
  Crown,
  Gift,
  Heart,
  Moon,
  Music,
  Pencil,
  Rocket,
  Ruler,
  Scissors,
  Sparkles,
  Star,
  Zap,
];
const GLAZES = [
  "#ffffff",
  "#ff5fa8",
  "#2a44ff",
  "#ffc31f",
  "#ff6a1f",
  "#5fb36b",
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

type Placed = {
  x: number;
  y: number;
  size: number;
  roll: number;
} & ({ kind: CookieKind } | { icon: LucideIcon; glaze: string });

/**
 * Random spots along the left and right edges (in %), alternating left and
 * right so the middle stays free. Half kinds, half icons.
 */
const place = (count: number): Placed[] => {
  const placed: Placed[] = [];
  for (let guard = 0; placed.length < count && guard < 600; guard++) {
    const left = placed.length % 2 === 0;
    const spot = {
      x: left ? Math.random() * 12 : 88 + Math.random() * 12,
      y: 20 + Math.random() * 78,
      size: 90 + Math.random() * 70,
      roll: Math.random() * 40 - 20,
    };
    const free = placed.every(
      (p) => Math.abs(p.x - spot.x) > 30 || Math.abs(p.y - spot.y) > 19
    );
    if (free) {
      placed.push(
        Math.floor(placed.length / 2) % 2
          ? { ...spot, icon: pick(ICONS), glaze: pick(GLAZES) }
          : { ...spot, kind: pick(KINDS) }
      );
    }
  }
  return placed;
};

/**
 * On start, cookies grow in one after another at random spots in the
 * background. They scroll with the page, down to just above the footer –
 * none lies on it.
 */
const CookieBackground = () => {
  const [cookies] = useState(() => place(window.innerWidth < 640 ? 5 : 8));
  const layerRef = useRef<HTMLDivElement>(null);

  // As tall as the page above the footer – again whenever the page changes.
  // The cookies are laid out against the page as it is at first (anew only
  // when the window's width changes): from then on each keeps its spot when
  // the page grows or shrinks below it – nothing stretches. Where the page
  // gets too short for one, it fades out until there is room again.
  useEffect(() => {
    const layer = layerRef.current;
    const app = layer?.parentElement;
    const footer = app?.querySelector(":scope > footer");
    if (!(layer && app && footer)) return;
    const spots = [...layer.children] as HTMLElement[];
    let width = -1;
    let tops: number[] = [];
    const fit = () => {
      const top = footer.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(0, top - 16);
      layer.style.height = `${height}px`;
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        // Below the header, and wholly above the footer.
        const header =
          9 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        tops = cookies.map(({ y, size }) =>
          Math.max(header, Math.min((height * y) / 100, height - size / 2))
        );
      }
      spots.forEach((spot, i) => {
        spot.style.top = `${tops[i]}px`;
        spot.toggleAttribute(
          "data-away",
          tops[i] + cookies[i].size / 2 > height
        );
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(app);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [cookies]);

  return (
    // Behind everything on the blue page, scrolling with it. Placed against
    // the page, not the app column – so they reach out to the window's
    // edges; as tall as the page above the footer (set above).
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-0 h-dvh w-full overflow-hidden"
      ref={layerRef}
    >
      {cookies.map((cookie, i) => (
        // No room for it above the footer (for now): out softly, not moved.
        <div
          className="absolute -translate-1/2 transition-opacity duration-400 data-away:opacity-0"
          key={i}
          style={{ left: `${cookie.x}%` }}
        >
          {/* Grow in one after another (the renderer animates that in 3D). */}
          {"kind" in cookie ? (
            <CookieIcon
              delay={900 + i * 220}
              idle={false}
              kind={cookie.kind}
              roll={cookie.roll}
              size={cookie.size}
            />
          ) : (
            <CookieIcon
              delay={900 + i * 220}
              icing={cookie.glaze}
              icon={cookie.icon}
              idle={false}
              roll={cookie.roll}
              size={cookie.size}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default memo(CookieBackground);
