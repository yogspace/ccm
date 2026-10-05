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
import { memo, useState } from "react";
import type { CookieKind } from "../cookies/models";
import CookieIcon from "./cookie-icon";

const KINDS: CookieKind[] = [
  "bite",
  "chip",
  "heart",
  "star",
  "flower",
  "gingerbread",
];
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
 * Zufällige Plätze am linken und rechten Rand (in %), abwechselnd links und
 * rechts, damit die Mitte frei bleibt. Halb Sorten, halb Icons.
 */
const place = (count: number): Placed[] => {
  const placed: Placed[] = [];
  for (let guard = 0; placed.length < count && guard < 600; guard++) {
    const left = placed.length % 2 === 0;
    const spot = {
      x: left ? Math.random() * 12 : 88 + Math.random() * 12,
      // Unterhalb des Headers, damit kein Keks hinter dem Titel liegt.
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

/** Beim Start wachsen nacheinander Kekse an zufälligen Stellen im Hintergrund herein. */
const CookieBackground = () => {
  const [cookies] = useState(() => place(window.innerWidth < 640 ? 5 : 8));

  return (
    <div aria-hidden className="cookie-background">
      {cookies.map((cookie, i) => (
        <div
          className="cookie-spot"
          key={i}
          style={{ left: `${cookie.x}%`, top: `${cookie.y}%` }}
        >
          {/* Wachsen nacheinander herein (der Renderer animiert das in 3D). */}
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
