import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { still } from "./card-link";

/**
 * The card leans towards the pointer, as if held in the hand – the front
 * only: on the back it holds still, so a bite lands where it is aimed.
 */
const useLean = (ref: RefObject<HTMLDivElement | null>, flipped: boolean) => {
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  useEffect(() => {
    const card = ref.current;
    if (!card || still()) return;
    const rest = () => {
      card.style.removeProperty("--lean-x");
      card.style.removeProperty("--lean-y");
    };
    const lean = (event: PointerEvent) => {
      if (flippedRef.current) {
        rest();
        return;
      }
      const { left, top, width, height } = card.getBoundingClientRect();
      const x = (event.clientX - (left + width / 2)) / window.innerWidth;
      const y = (event.clientY - (top + height / 2)) / window.innerHeight;
      card.style.setProperty("--lean-x", `${(-y * 16).toFixed(2)}deg`);
      card.style.setProperty("--lean-y", `${(x * 20).toFixed(2)}deg`);
    };
    window.addEventListener("pointermove", lean);
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", lean);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, [ref]);
};

type Props = {
  flipped: boolean;
  /**
   * Turned, with cookie left: a stray click (one beside the cookie, a quick
   * double tap) does not turn it back – only the sticker does, or the
   * keyboard.
   */
  held: boolean;
  disabled: boolean;
  onTurn: () => void;
  front: ReactNode;
  back: ReactNode;
};

/**
 * The card: tilted a little, leaning towards the pointer – a click turns
 * it over, the cutter in front, the cookie it bakes on the back. Once
 * landed, it wobbles as if about to turn – a hint it can; on its own
 * property (rotate), so the turn itself (transform) still transitions.
 */
const GreetingCard = ({
  flipped,
  held,
  disabled,
  onTurn,
  front,
  back,
}: Props) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  useLean(cardRef, flipped);
  return (
    <div
      className="pointer-events-auto absolute inset-[20.5%] animate-[card-land_1.1s_var(--ease-spring)_0.15s_both] transition-transform duration-900 transform-3d transform-[perspective(70rem)_rotateX(var(--lean-x,0deg))_rotateY(var(--lean-y,0deg))_rotate(-3deg)]"
      data-part="card"
      ref={cardRef}
    >
      <button
        aria-label={t(flipped ? "card.flipBack" : "card.flip")}
        aria-pressed={flipped}
        className="relative block size-full rounded-[5.5cqw] bg-transparent p-0 whitespace-normal text-inherit transform-3d [font:inherit] [text-align:inherit] [transition:transform_0.95s_var(--ease-spring)] not-disabled:not-data-flipped:animate-[greet-peek_1.4s_var(--ease-soft)_2.4s] focus-visible:outline-3 focus-visible:outline-offset-8 focus-visible:outline-on-page disabled:cursor-default disabled:opacity-100 data-held:cursor-default data-flipped:transform-[rotateY(180deg)]"
        data-flipped={flipped || undefined}
        data-held={held || undefined}
        disabled={disabled}
        onClick={(event) => {
          const onSticker = (event.target as Element).closest("[data-turn]");
          // detail 0: from the keyboard.
          if (held && event.detail > 0 && !onSticker) return;
          onTurn();
        }}
        type="button"
      >
        {front}
        {back}
      </button>
    </div>
  );
};

export default GreetingCard;
