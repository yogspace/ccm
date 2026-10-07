import { memo, useEffect, useRef, useState } from "react";
import CookieIcon from "../components/cookie-icon";
import type { CookieShape } from "../cookies/models";

/** Centre in px within the layer, size in px. */
type Spot = { x: number; y: number; size: number; roll: number };

/** Air between the ring's letters and the cookies, and around the text (px). */
const GAP = 14;
/** What the cookies must never lie on: the texts and the dock. */
const KEEP_CLEAR = [
  ".greeting-to",
  ".greeting-from",
  ".greeting-dock",
  ".greeting-credit",
];

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right + GAP &&
  a.right > b.left - GAP &&
  a.top < b.bottom + GAP &&
  a.bottom > b.top - GAP;

/**
 * A circle of cookies around the card, just outside the ring of words –
 * evenly spaced, leaving out every place that would lie on a text or the
 * dock, or outside the screen. On a phone the ring fills the width, so only
 * the places above and below it can stay – often none, and that is fine.
 */
const place = (layer: DOMRect): Spot[] => {
  const ring = document.querySelector(".greeting .ring-text text");
  const stage = document.querySelector(".greeting-stage");
  if (!(ring && stage)) return [];
  const box = stage.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const letters = ring.getBoundingClientRect();
  const outer = Math.max(letters.width, letters.height) / 2;
  // Few and big.
  const size = Math.min(150, Math.max(84, box.width * 0.21));
  const radius = outer + GAP + size / 2;
  const count = Math.max(
    4,
    Math.min(10, Math.floor((2 * Math.PI * radius) / (size * 1.9)))
  );
  const clear = KEEP_CLEAR.flatMap((selector) => {
    const element = document.querySelector(selector);
    return element ? [element.getBoundingClientRect()] : [];
  });

  const spots: Spot[] = [];
  for (let i = 0; i < count; i++) {
    // Starting half a step from the top: the top is the heading's anyway.
    const angle = ((i + 0.5) / count) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const cookie = new DOMRect(x - size / 2, y - size / 2, size, size);
    const onScreen =
      cookie.left >= layer.left &&
      cookie.right <= layer.right &&
      cookie.top >= layer.top &&
      cookie.bottom <= layer.bottom;
    if (!onScreen || clear.some((rect) => overlaps(cookie, rect))) continue;
    spots.push({
      x: x - layer.left,
      y: y - layer.top,
      size,
      roll: Math.random() * 60 - 30,
    });
  }
  return spots;
};

/**
 * The cookie the card's cutter bakes, in a circle around the card – like the
 * editor's background cookies they look at the mouse when it comes near, and
 * grow in one after another once the card is there. Laid out anew when the
 * screen changes (a phone turned).
 */
const CardCookies = ({ shape }: { shape: CookieShape }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Spot[]>([]);

  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    let timer = 0;
    const layout = () => setSpots(place(layer.getBoundingClientRect()));
    // After the card has settled in; again, calmly, after every resize.
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(layout, 200);
    });
    observer.observe(layer);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-hidden className="greeting-cookies" ref={ref}>
      {spots.map((spot, i) => (
        <div
          className="greeting-cookie-spot"
          key={`${Math.round(spot.x)}-${Math.round(spot.y)}`}
          style={{ left: spot.x, top: spot.y }}
        >
          <CookieIcon
            delay={500 + i * 140}
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
