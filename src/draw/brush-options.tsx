import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import CookieSlider from "../components/cookie-slider";
import { EMBOSS_INK, type Ink } from "../drawing";

type Props = {
  /** The slider – drawing, or something selected to change; else a hint. */
  shown: boolean;
  brush: number;
  onChange: (value: number) => void;
  /** The ink swatches – for the pen, or something selected to recolour. */
  inks: boolean;
  ink: Ink;
  onInk: (ink: Ink) => void;
};

const INKS = [
  ["cut", "#000000", "draw.cut", "draw.cutHint"],
  ["emboss", EMBOSS_INK, "draw.emboss", "draw.embossHint"],
] as const;

/**
 * Below (or beside) the drawing area: the pen's ink – black cuts, pink
 * embosses – and the brush size, a dot as big as it next to the slider –
 * while moving with nothing selected, a hint instead. As tall as the slider
 * even then: no jumping.
 */
const BrushOptions = ({ shown, brush, onChange, inks, ink, onInk }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-9 min-w-0 items-center gap-3 [grid-area:options]">
      {inks && (
        // biome-ignore lint/a11y/useSemanticElements: a pair of toggles, not a form
        <div
          aria-label={t("draw.ink")}
          className="flex flex-none items-center gap-2"
          role="group"
        >
          {INKS.map(([value, color, label, hint]) => (
            <button
              aria-label={t(label)}
              aria-pressed={ink === value}
              // As the favorite colors (color-swatches.tsx): the chosen one
              // ringed, the ring springing out from under the gap.
              className="size-6 rounded-full bg-(--swatch) p-0 [box-shadow:0_0_0_2px_var(--color-card),0_0_0_2px_var(--swatch)] [transition:box-shadow_0.45s_var(--ease-spring),scale_0.25s_var(--ease-spring)] hover:enabled:scale-110 aria-pressed:[box-shadow:0_0_0_2px_var(--color-card),0_0_0_4px_var(--swatch)]"
              key={value}
              onClick={() => onInk(value)}
              style={{ "--swatch": color } as CSSProperties}
              title={`${t(label)} – ${t(hint)}`}
              type="button"
            />
          ))}
        </div>
      )}
      {shown ? (
        <div className="flex max-w-64 min-w-28 flex-1 items-center gap-3 @max-[34rem]/draw:max-w-none beside:max-w-72 xl:not-in-data-expanded:min-w-24">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center after:size-(--dot) after:rounded-full after:bg-(--dot-ink) after:transition-[width,height,background-color] after:duration-150"
            style={
              {
                "--dot": `${4 + ((brush - 6) / 58) * 16}px`,
                // In the pen's ink – black stays the page's ink colour.
                "--dot-ink":
                  inks && ink === "emboss" ? EMBOSS_INK : "var(--color-ink)",
              } as CSSProperties
            }
          />
          <CookieSlider
            label={t("draw.brush")}
            max={64}
            min={6}
            onChange={onChange}
            step={1}
            value={brush}
          />
        </div>
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-small text-muted"
          title={t("draw.moveHint")}
        >
          {t("draw.moveHint")}
        </span>
      )}
    </div>
  );
};

export default BrushOptions;
