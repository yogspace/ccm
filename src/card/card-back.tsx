import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import CookieIcon from "../components/cookie-icon";
import type { Bite } from "../cookies/bites";
import type { CookieShape } from "../cookies/shape-cookie";
import { BACK_TILT } from "./bite";
import { CardLabel, Paper, TurnSticker, WaitingNote } from "./card-parts";

type Props = {
  /** The message behind the cookie. */
  message: string;
  /** The cookie the cutter bakes, in the favorite color – null while it bakes. */
  cookie: CookieShape | null;
  bites: Bite[];
  eaten: boolean;
  onBite: (event: MouseEvent<HTMLElement>) => void;
  name: string;
};

/**
 * The card's back, in the favorite color, strong: the cookie the cutter
 * bakes, to be bitten – behind it the message, more of it with every bite.
 * Nothing on it gets selected when the cookie is bitten in quick taps.
 */
const CardBack = ({ message, cookie, bites, eaten, onBite, name }: Props) => {
  const { t } = useTranslation();
  /** “Baking your cookie” stays a moment once the cookie lies there. */
  const [bakingShown, setBakingShown] = useState(true);
  useEffect(() => {
    if (!cookie) {
      setBakingShown(true);
      return;
    }
    const timer = setTimeout(() => setBakingShown(false), 500);
    return () => clearTimeout(timer);
  }, [cookie]);
  return (
    <Paper className="invisible bg-card-back select-none transform-[rotateY(180deg)] in-data-flipped:visible">
      {/* The message, in the back's color, a little darker – fine, but
          readable. Smaller for longer messages – and so small that the
          longest word fits the card's width (Pally's letters about 0.56em
          wide). */}
      <span
        className="col-start-1 row-start-1 self-center px-[4cqw] text-center text-[clamp(5cqw,min(64cqw/(var(--chars,12)*0.24+3),42cqw/(var(--word,6)*0.56)),10cqw)] leading-[1.05] font-bold tracking-tight text-balance wrap-break-word text-card-back-ink"
        style={
          {
            "--chars": message.length,
            // Its longest word fits a line – not broken apart.
            "--word": Math.max(
              ...message.split(/\s+/).map((word) => word.length)
            ),
          } as CSSProperties
        }
      >
        {message}
      </span>
      {cookie && (
        // A click bites where it lands; the last bite eats it up and the
        // greeting takes its place.
        // biome-ignore lint/a11y/noStaticElementInteractions: a playful extra – the card itself turns by keyboard
        // biome-ignore lint/a11y/useKeyWithClickEvents: as above
        <span
          className="col-start-1 row-start-1 grid min-h-0 cursor-pointer justify-items-center [transition:scale_0.35s_var(--ease-soft),opacity_0.35s_var(--ease-soft)] data-eaten:pointer-events-none data-eaten:scale-30 data-eaten:opacity-0"
          data-eaten={eaten || undefined}
          onClick={onBite}
          title={eaten ? undefined : t("card.bite")}
        >
          <CookieIcon
            bites={bites.length > 0 ? bites : undefined}
            className="m-0 aspect-square h-full min-h-0 w-auto justify-self-center"
            // Baked, it is simply there – fresh again too.
            grown
            // Still: drawn once, no frames while it lies there.
            idle={false}
            interactive={false}
            shape={cookie}
            size={320}
            tilt={BACK_TILT}
          />
        </span>
      )}
      {/* Turned before it is baked: it bakes here, over the message –
          nothing is given away before the first bite – and goes like the
          note in front once the cookie is there. */}
      {(!cookie || bakingShown) && (
        <WaitingNote
          className="bg-card-back text-card-back-ink"
          gone={!!cookie}
          interactive={false}
        >
          {t("card.baking")}
        </WaitingNote>
      )}
      <CardLabel
        name={name}
        note={cookie && t(eaten ? "card.eaten" : "card.baked")}
      />
      <TurnSticker interactive={false} />
    </Paper>
  );
};

export default CardBack;
