import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../cn";
import CookieIcon from "../components/cookie-icon";
import { cookieInButton } from "../components/styles";

/**
 * A side of the card. The far side hides when the card stands on edge –
 * with the springy turn after about a sixth of it – and its canvas with it.
 * A long name is cut, it does not widen the card.
 */
export const Paper = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <span
    className={cn(
      "absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] rounded-[5.5cqw] bg-card-sheet px-[4.5cqw] py-[4cqw] text-card-ink shadow-[0_0.6rem_1.2rem_-0.4rem_rgb(4_8_60/0.35),0_2.8rem_4.5rem_-1.8rem_rgb(4_8_60/0.6)] backface-hidden [transition:visibility_0s_linear_0.17s]",
      className
    )}
  >
    {children}
  </span>
);

/** Like a label: the name left, the size (or how it is) right. */
export const CardLabel = ({
  name,
  note,
  hidden,
}: {
  name: string;
  note: ReactNode;
  hidden?: boolean;
}) => (
  <span
    className="flex items-baseline justify-between gap-[0.6em] px-[1.2cqw] text-left text-[4.6cqw] leading-[1.2] font-bold tracking-title"
    hidden={hidden}
  >
    <span className="min-w-0 truncate">{name}</span>
    <small className="flex-none text-[0.68em] font-semibold text-card-ink-muted">
      {note}
    </small>
  </span>
);

/**
 * A sticker in the corner: this card turns over. In front it turns along
 * on hover – a hint; on the back it holds still while the cookie is
 * bitten – and is the way back until it is eaten up (greeting-card.tsx).
 */
export const TurnSticker = ({ interactive }: { interactive: boolean }) => (
  <span
    aria-hidden
    className="absolute top-[2.2cqw] right-[2.2cqw] grid cursor-pointer place-items-center"
    data-turn
  >
    <CookieIcon
      className="m-0 size-[8cqw]"
      icing="#2a44ff"
      icon={RotateCw}
      idle={false}
      interactive={interactive}
      size={56}
    />
  </span>
);

/**
 * A note while something is on its way (the cutter in front, the cookie on
 * the back): a spinning star and a line. Once it is there (`gone`), the
 * note stays a moment and fades out softly while it appears in its place.
 */
export const WaitingNote = ({
  gone,
  spin = true,
  interactive = true,
  className,
  children,
}: {
  gone: boolean;
  spin?: boolean;
  /** The star turns along when the card is hovered. */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <span
    aria-hidden={gone || undefined}
    className={cn(
      "col-start-1 row-start-1 grid min-h-0 place-items-center content-center gap-[0.6em] px-[8%] text-[3.4cqw] leading-[1.3] [transition:opacity_0.45s_var(--ease-soft),scale_0.45s_var(--ease-soft)] data-gone:pointer-events-none data-gone:scale-90 data-gone:opacity-0",
      className
    )}
    data-gone={gone || undefined}
  >
    <CookieIcon
      className={cookieInButton}
      idle={false}
      interactive={interactive}
      kind="star"
      size={88}
      spin={spin}
    />
    <span aria-live="polite">{children}</span>
  </span>
);
