import { type CSSProperties, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSiteLinks } from "../site-context";
import CookieIcon from "./cookie-icon";

/** Sprinkles that shoot out of the sun on hover: angle, color, delay. */
const SPRINKLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * 360 + (i % 2 ? 9 : -6),
  color: ["#ff5fa8", "#ffffff", "#ff6a1f", "#5fb36b", "#fdf8ef"][i % 5],
  delay: (i % 3) * 40,
}));
/**
 * Donation link as a sun cookie sticking out at a box's bottom left corner
 * (footer); the text lies on the icing and grows in with it – dark on the
 * icing in every theme. It hops now and then, to catch the eye; on hover it
 * straightens up, turns once (in 3D) and sprinkles fly. `delay` (ms) holds
 * the growing back, e.g. until a dialog has opened.
 */
const DonateBadge = ({ delay = 0 }: { delay?: number }) => {
  const { t } = useTranslation();
  const { donate } = useSiteLinks();
  // The text grows in with the sun (directly on the element, without a re-render).
  const textRef = useRef<HTMLSpanElement>(null);

  return (
    <a
      aria-label={t("footer.donateLabel")}
      className="group/donate absolute -bottom-1.5 -left-4 grid size-28 animate-[sun-hop_7s_ease-in-out_3s_infinite] place-items-center text-[#0d1033] -rotate-12 transition-[rotate,scale] duration-500 ease-spring hover:scale-112 hover:rotate-4 hover:[animation-play-state:paused] active:scale-95 max-sm:-left-1.5 max-sm:size-24 max-sm:[--cookie-scale:0.86]"
      data-donate
      href={donate}
      rel="noopener"
      target="_blank"
      title={t("footer.donateLabel")}
    >
      {SPRINKLES.map(({ angle, color, delay }) => (
        <i
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 block h-1 w-2.5 rounded-full bg-(--color) opacity-0 group-hover/donate:animate-[sprinkle_0.75s_var(--ease-soft)_var(--delay)_both]"
          key={angle}
          style={
            {
              "--angle": `${angle}deg`,
              "--color": color,
              "--delay": `${delay}ms`,
            } as CSSProperties
          }
        />
      ))}
      {/* Almost flat, not looking at the mouse; turns slowly in the image plane –
          the sun looks the same all round, the text stays readable. */}
      <CookieIcon
        className="absolute inset-0 m-auto"
        delay={delay}
        interactive={false}
        kind="sun"
        onGrow={(scale) =>
          textRef.current?.style.setProperty("scale", String(scale))
        }
        size={120}
        spin
        spinSpeed={0.35}
        tilt={-0.15}
      />
      <span
        className="relative flex scale-0 flex-col items-center text-center text-small leading-[1.05] font-bold"
        ref={textRef}
      >
        <small className="text-tiny font-medium">{t("footer.donateTop")}</small>
        {t("footer.donateMain")}
      </span>
    </a>
  );
};

export default DonateBadge;
