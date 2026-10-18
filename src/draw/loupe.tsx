import { type Ref, type RefObject, useImperativeHandle, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A loupe over the finger – like the one iOS shows over a text's cursor: a
 * little round window above where the finger is, the drawing beneath it
 * twice as big, a cross on the very spot. Only for a finger, which covers
 * what it draws on; moved and filled without a render (`show`) – copied
 * from the drawing's canvas (`source`) as it is.
 *
 * It lies over the whole page (a portal) and goes wherever the finger goes.
 * It stays the same way above the finger; where the screen's top leaves no
 * room, it glides aside – the closer to the top, the further – to the side
 * with more room, which it keeps until there is room above again. A layer of
 * its own (translate3d): moving it repaints nothing under it.
 */

/** How wide the loupe is (px), how much bigger it shows, how far above. */
const SIZE = 104;
const ZOOM = 2;
const ABOVE = 96;
/** How near (px) it comes to the screen's edges. */
const MARGIN = 8;

/** The screen's top that is the phone's (its notch, the clock) – px. */
let safeTop: number | null = null;
const topOfScreen = () => {
  if (safeTop !== null) return safeTop;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;height:env(safe-area-inset-top,0px)";
  document.body.append(probe);
  safeTop = probe.offsetHeight;
  probe.remove();
  return safeTop;
};

const within = (n: number, low: number, high: number) =>
  Math.min(Math.max(n, low), high);

export type LoupeHandle = {
  /**
   * Over the finger at a client point – which lies at (x, y) px on the
   * stage, `side` px wide.
   */
  show: (at: {
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    side: number;
  }) => void;
  hide: () => void;
};

const Loupe = ({
  ref,
  source,
}: {
  ref: Ref<LoupeHandle>;
  /** The drawing's canvas – it covers the stage. */
  source: RefObject<HTMLCanvasElement | null>;
}) => {
  const lens = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  // Which way it went aside (−1 left, 1 right) – none while there is room.
  const aside = useRef(0);
  useImperativeHandle(ref, () => ({
    show: ({ clientX, clientY, x, y, side }) => {
      const el = lens.current;
      const canvas = view.current;
      const from = source.current;
      if (!(el && canvas && from && side)) return;
      // Its middle at the highest: under the screen's top.
      const highest = topOfScreen() + MARGIN + SIZE / 2;
      const above = clientY - ABOVE;
      // How much room above is missing: 0 – enough, 1 – level with the finger.
      const missing = within((highest - above) / ABOVE, 0, 1);
      if (!missing) aside.current = 0;
      else if (!aside.current) {
        aside.current = clientX > innerWidth / 2 ? -1 : 1;
      }
      const glide = missing * missing * (3 - 2 * missing);
      const cx = within(
        clientX + aside.current * glide * ABOVE,
        SIZE / 2 + MARGIN,
        innerWidth - SIZE / 2 - MARGIN
      );
      const cy = Math.max(above, highest);
      el.style.transform = `translate3d(${(cx - SIZE / 2).toFixed(1)}px, ${(cy - SIZE / 2).toFixed(1)}px, 0)`;
      el.style.opacity = "1";
      // What lies under the finger, twice as big.
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const px = Math.round(SIZE * ratio);
      if (canvas.width !== px) canvas.width = canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const k = from.width / side;
      const span = (SIZE / ZOOM) * k;
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(
        from,
        x * k - span / 2,
        y * k - span / 2,
        span,
        span,
        0,
        0,
        px,
        px
      );
    },
    hide: () => {
      aside.current = 0;
      if (lens.current) lens.current.style.opacity = "0";
    },
  }));
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-60 transform-[translate3d(0,0,0)] overflow-hidden rounded-full border-[2.5px] border-ink bg-paper opacity-0 shadow-[0_6px_18px_rgb(13_16_51/0.22)] transition-opacity duration-100"
      ref={lens}
      style={{ width: SIZE, height: SIZE }}
    >
      <canvas className="absolute inset-0 size-full" ref={view} />
      {/* The very spot. */}
      <svg
        aria-hidden
        className="absolute inset-0 size-full"
        fill="none"
        stroke="var(--color-ink)"
        strokeLinecap="round"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <path
          d={`M${SIZE / 2} ${SIZE / 2 - 9}v5M${SIZE / 2} ${SIZE / 2 + 4}v5M${SIZE / 2 - 9} ${SIZE / 2}h5M${SIZE / 2 + 4} ${SIZE / 2}h5`}
          stroke="white"
          strokeWidth={3.5}
        />
        <path
          d={`M${SIZE / 2} ${SIZE / 2 - 9}v5M${SIZE / 2} ${SIZE / 2 + 4}v5M${SIZE / 2 - 9} ${SIZE / 2}h5M${SIZE / 2 + 4} ${SIZE / 2}h5`}
          strokeWidth={1.5}
        />
      </svg>
    </div>,
    document.body
  );
};

export default Loupe;
