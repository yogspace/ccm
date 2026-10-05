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
import { motion } from "motion/react";
import { useState } from "react";
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

/** Zufällige, nicht überlappende Plätze im Fenster (in %). Halb Sorten, halb Icons. */
const place = (count: number): Placed[] => {
  const placed: Placed[] = [];
  for (let guard = 0; placed.length < count && guard < 400; guard++) {
    const spot = {
      x: 5 + Math.random() * 90,
      // Unterhalb des Headers, damit kein Keks hinter dem Titel liegt.
      y: 22 + Math.random() * 72,
      size: 80 + Math.random() * 70,
      roll: Math.random() * 40 - 20,
    };
    if (placed.every((p) => Math.hypot(p.x - spot.x, p.y - spot.y) > 22)) {
      placed.push(
        placed.length % 2
          ? { ...spot, icon: pick(ICONS), glaze: pick(GLAZES) }
          : { ...spot, kind: pick(KINDS) }
      );
    }
  }
  return placed;
};

/** Beim Start ploppen nacheinander Kekse an zufälligen Stellen im Hintergrund auf. */
const CookieBackground = () => {
  const [cookies] = useState(() => place(window.innerWidth < 640 ? 5 : 8));

  return (
    <div aria-hidden className="cookie-background">
      {cookies.map((cookie, i) => (
        <motion.div
          animate={{ scale: 1, opacity: 1 }}
          className="cookie-spot"
          initial={{ scale: 0, opacity: 0 }}
          key={i}
          style={{ left: `${cookie.x}%`, top: `${cookie.y}%` }}
          transition={{
            delay: 0.2 + i * 0.12,
            type: "spring",
            stiffness: 260,
            damping: 14,
          }}
        >
          {"kind" in cookie ? (
            <CookieIcon
              idle={false}
              kind={cookie.kind}
              roll={cookie.roll}
              size={cookie.size}
            />
          ) : (
            <CookieIcon
              icing={cookie.glaze}
              icon={cookie.icon}
              idle={false}
              roll={cookie.roll}
              size={cookie.size}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default CookieBackground;
