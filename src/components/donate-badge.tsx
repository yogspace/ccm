import { type CSSProperties, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSiteLinks } from "../site-context";
import CookieIcon from "./cookie-icon";

/** Sprinkles that shoot out of the sun on hover: angle, colour, delay. */
const SPRINKLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * 360 + (i % 2 ? 9 : -6),
  color: ["#ff5fa8", "#ffffff", "#ff6a1f", "#5fb36b", "#fdf8ef"][i % 5],
  delay: (i % 3) * 40,
}));
/**
 * Donation link as a sun cookie at a box's bottom left corner (footer, share
 * dialog); the text lies on the icing and grows in with it. `delay` (ms)
 * holds the growing back, e.g. until a dialog has opened.
 */
const DonateBadge = ({ delay = 0 }: { delay?: number }) => {
  const { t } = useTranslation();
  const { donate } = useSiteLinks();
  // The text grows in with the sun (directly on the element, without a re-render).
  const textRef = useRef<HTMLSpanElement>(null);

  return (
    <a
      aria-label={t("footer.donateLabel")}
      className="donate"
      href={donate}
      rel="noopener"
      target="_blank"
      title={t("footer.donateLabel")}
    >
      {SPRINKLES.map(({ angle, color, delay }) => (
        <i
          aria-hidden
          className="sprinkle"
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
      <span className="donate-text" ref={textRef}>
        <small>{t("footer.donateTop")}</small>
        {t("footer.donateMain")}
      </span>
    </a>
  );
};

export default DonateBadge;
