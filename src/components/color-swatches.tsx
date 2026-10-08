import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useCardColors } from "../site-context";

type Props = {
  /** The chosen color's number (useCardColor's `chosen`). */
  value: number;
  onChange: (color: number) => void;
};

/**
 * The favorite colors from the CMS as round swatches, the chosen one
 * ringed – for the share picture and the greeting card alike.
 */
const ColorSwatches = ({ value, onChange }: Props) => {
  const { t, i18n } = useTranslation();
  const colors = useCardColors();
  const lang = i18n.resolvedLanguage === "de" ? "de" : "en";
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-small font-bold text-ink">
        {t("card.color")}
      </legend>
      <div className="flex flex-wrap gap-2">
        {colors.map(({ color, name }, index) => (
          <button
            aria-label={name[lang]}
            aria-pressed={value === index}
            // The ring in its color lies hidden under the gap in the card's
            // color; chosen, it springs out from under it.
            className="size-8 rounded-full bg-(--swatch) p-0 [box-shadow:0_0_0_2px_var(--color-card),0_0_0_2px_var(--swatch)] [transition:box-shadow_0.45s_var(--ease-spring),scale_0.25s_var(--ease-spring)] hover:enabled:scale-110 aria-pressed:[box-shadow:0_0_0_2px_var(--color-card),0_0_0_4px_var(--swatch)]"
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
