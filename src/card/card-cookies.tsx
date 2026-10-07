import { memo, useLayoutEffect, useRef, useState } from "react";
import CookieIcon from "../components/cookie-icon";
import type { CookieShape } from "../cookies/models";

/** x and y in % of the page, size in px. */
type Spot = { x: number; y: number; size: number; roll: number };

/** Room kept free above the dock and the “made by” (px). */
const CLEARANCE = 16;

/**
 * Random spots along the left and right edges, alternating sides, so the card
 * in the middle stays free – and every cookie entirely above `floor` (px from
 * the top): never under or on the dock and the credit at the bottom.
 */
const place = (count: number, height: number, floor: number): Spot[] => {
  const spots: Spot[] = [];
  for (let guard = 0; spots.length < count && guard < 400; guard++) {
    const left = spots.length % 2 === 0;
    const size = 80 + Math.random() * 70;
    const top = size / 2 + 12;
    const bottom = floor - size / 2 - CLEARANCE;
    if (bottom <= top) break;
    const spot = {
      x: left ? Math.random() * 14 : 86 + Math.random() * 14,
      y: ((top + Math.random() * (bottom - top)) / height) * 100,
      size,
      roll: Math.random() * 60 - 30,
    };
    const free = spots.every(
      (other) =>
        Math.abs(other.x - spot.x) > 30 || Math.abs(other.y - spot.y) > 22
    );
    if (free) spots.push(spot);
  }
  return spots;
};

/**
 * The cookie the card's cutter bakes, a few times in the background – like
 * the editor's background cookies they look at the mouse when it comes near,
 * and grow in one after another once the card is there. Placed once the page
 * stands, above the dock; fewer on phones, where the card page has to stay
 * light.
 */
const CardCookies = ({ shape }: { shape: CookieShape }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Spot[]>([]);

  useLayoutEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const box = layer.getBoundingClientRect();
    // The highest of what sits at the bottom: the dock and the credit.
    const floor = Math.min(
      box.height,
      ...[".greeting-dock", ".greeting-credit"].flatMap((selector) => {
        const element = document.querySelector(selector);
        return element ? [element.getBoundingClientRect().top - box.top] : [];
      })
    );
    setSpots(place(window.innerWidth < 640 ? 3 : 6, box.height, floor));
  }, []);

  return (
    <div aria-hidden className="greeting-cookies" ref={ref}>
      {spots.map((spot, i) => (
        <div
          className="greeting-cookie-spot"
          key={`${spot.x}-${spot.y}`}
          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        >
          <CookieIcon
            delay={700 + i * 260}
            idle={false}
            roll={spot.roll}
            shape={shape}
            size={Math.round(spot.size)}
            tilt={-0.45}
          />
        </div>
      ))}
    </div>
  );
};

export default memo(CardCookies);
