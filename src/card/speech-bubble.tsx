import { AnimatePresence, motion } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { still } from "./card-link";

const springy = { type: "spring", stiffness: 520, damping: 26 } as const;

type Props = {
  shown: boolean;
  /** Seconds after it is shown before it pops up. */
  delay: number;
  /** What it says – a new key, new words. */
  say: { key: string; text: ReactNode };
  /** Tilted to this side (deg) – a new value swings it over, boing. */
  swing?: number;
};

/**
 * A speech bubble at the card's upper left corner (on phones, where the
 * stage runs out at the sides, above it): a sticker – a pill in the color of
 * the card's back with a white rim, its tail towards the card, a little
 * tilted and bobbing; clicks go through. It pops up `delay` after it is
 * shown and goes right away. New words spring in from below while the old
 * ones hop away, the bubble growing or shrinking along – and swinging over.
 */
const SpeechBubble = ({ shown, delay, say, swing = 0 }: Props) => {
  const clipId = useId();
  const motionless = still();
  const transition = motionless ? { duration: 0 } : springy;
  // The width the words need (with the padding), measured on a copy of them
  // – the bubble goes there in its own width, nothing in it is stretched.
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new words, a new width
  useLayoutEffect(() => {
    const copy = measureRef.current;
    if (!copy) return;
    const measure = () => setWidth(copy.offsetWidth);
    measure();
    // The font arriving, the stage changing size – the words too.
    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [say.key]);
  return (
    <small
      aria-hidden
      className="pointer-events-none invisible absolute right-[69%] bottom-[71%] z-1 origin-bottom-right animate-[eat-me_1.6s_ease-in-out_infinite] scale-50 -rotate-4 text-[3.8cqw] leading-none font-bold whitespace-nowrap text-card-deep opacity-0 [transition:opacity_0.25s_var(--ease-soft),scale_0.25s_var(--ease-soft),visibility_0s_linear_0.25s] motion-reduce:animate-none data-shown:visible data-shown:scale-100 data-shown:opacity-100 data-shown:[transition:opacity_0.3s_var(--ease-soft)_var(--bubble-delay),scale_0.55s_var(--ease-spring)_var(--bubble-delay),visibility_0s_linear_var(--bubble-delay)] max-xs:right-auto max-xs:bottom-[78%] max-xs:left-[21%]"
      data-shown={shown || undefined}
      style={{ "--bubble-delay": `${delay}s` } as CSSProperties}
    >
      <motion.span
        animate={{ rotate: swing }}
        className="relative block rounded-full border-[0.45cqw] border-white bg-card-back drop-shadow-[0_0.9cqw_1.4cqw_rgb(5_10_60/0.32)]"
        transition={
          motionless
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 7 }
        }
      >
        {/* The words – old and new in one place while they swap: the old
            ones hop away, the new spring in, both kept inside the bubble's
            round edge as it grows or shrinks. */}
        <motion.span
          animate={width === null ? undefined : { width }}
          // One column as wide as the bubble (not as the longest words), the
          // words centered in it even where they are wider – they run over
          // both sides alike and are cut there.
          className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[inherit] px-[3cqw] pt-[1.7cqw] pb-[1.8cqw] [justify-items:unsafe_center] *:col-start-1 *:row-start-1"
          initial={false}
          transition={transition}
        >
          <AnimatePresence initial={false}>
            <motion.span
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: "-90%", scale: 0.5, rotate: 10 }}
              initial={{ opacity: 0, y: "90%", scale: 0.5, rotate: -10 }}
              key={say.key}
              transition={transition}
            >
              {say.text}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <span
          className="invisible absolute top-0 left-0 px-[3cqw]"
          ref={measureRef}
        >
          {say.text}
        </span>
        {/* The tail, from the rim's inner edge: its fill covers the rim
            where it leaves the bubble, the white runs on along its two
            sides – cut off at the top, so none of it reaches into the
            bubble. 10 units are 1cqw: the rim is 4.5 wide. */}
        <svg
          aria-hidden
          className="absolute top-full right-[14%] h-[3.6cqw] w-[4.4cqw] overflow-visible fill-card-back stroke-white"
          viewBox="0 0 44 36"
        >
          <clipPath id={clipId}>
            <rect height="60" width="70" x="-10" y="0" />
          </clipPath>
          {/* The white first, the fill over it: only the outer half of the
              line shows – as wide as the rim. */}
          <path
            clipPath={`url(#${clipId})`}
            d="M2 0 Q22 30 40 33 Q30 20 26 0"
            fill="none"
            strokeLinejoin="round"
            strokeWidth="9"
          />
          <path d="M2 0 H26 Q30 20 40 33 Q22 30 2 0 Z" stroke="none" />
        </svg>
      </motion.span>
    </small>
  );
};

export default SpeechBubble;
