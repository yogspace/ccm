import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import CookieIcon from "./cookie-icon";

const DONATE_URL = "https://paypal.me/yogspace";

/** Streusel, die beim Hover aus der Sonne schießen: Winkel, Farbe, Verzögerung. */
const SPRINKLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * 360 + (i % 2 ? 9 : -6),
  color: ["#ff5fa8", "#ffffff", "#ff6a1f", "#5fb36b", "#fdf8ef"][i % 5],
  delay: (i % 3) * 40,
}));
/** Spendenlink als Sonnen-Keks am rechten Rand des Footers, die Schrift liegt auf dem Guss. */
const DonateBadge = () => {
  const { t } = useTranslation();

  return (
    <a
      aria-label={t("footer.donateLabel")}
      className="donate"
      href={DONATE_URL}
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
      {/* Fast flach, ohne Mausblick; dreht sich langsam in der Bildebene –
          die Sonne sieht rundum gleich aus, die Schrift bleibt lesbar. */}
      <CookieIcon
        interactive={false}
        kind="sun"
        size={120}
        spin
        spinSpeed={0.35}
        tilt={-0.15}
      />
      <span className="donate-text">
        <small>{t("footer.donateTop")}</small>
        {t("footer.donateMain")}
      </span>
    </a>
  );
};

export default DonateBadge;
