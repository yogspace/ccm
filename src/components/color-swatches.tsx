import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useCardColors } from "../site-context";

type Props = {
  /** The chosen colour's number (useCardColor's `chosen`). */
  value: number;
  onChange: (color: number) => void;
};

/**
 * The favourite colours from the CMS as round swatches, the chosen one
 * ringed – for the share picture and the greeting card alike.
 */
const ColorSwatches = ({ value, onChange }: Props) => {
  const { t, i18n } = useTranslation();
  const colors = useCardColors();
  const lang = i18n.resolvedLanguage === "de" ? "de" : "en";
  return (
    <fieldset className="composer-colors">
      <legend>{t("card.color")}</legend>
      <div className="composer-swatches">
        {colors.map(({ color, name }, index) => (
          <button
            aria-label={name[lang]}
            aria-pressed={value === index}
            className="composer-swatch"
            key={`${index}-${color}`}
            onClick={() => onChange(index)}
            style={{ "--swatch": color } as CSSProperties}
            title={name[lang]}
            type="button"
          />
        ))}
      </div>
    </fieldset>
  );
};

export default ColorSwatches;
