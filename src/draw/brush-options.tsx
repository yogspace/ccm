import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import CookieSlider from "../components/cookie-slider";
import { EMBOSS_INK, type Ink } from "../drawing";

type Props = {
  /** The slider – drawing, or something selected to change; else a hint. */
  shown: boolean;
  brush: number;
  onChange: (value: number) => void;
  /** The ink can change – for the pen, or something selected to recolour. */
  inks: boolean;
  ink: Ink;
  onInk: (ink: Ink) => void;
};

const LABEL = { cut: "draw.cut", emboss: "draw.emboss" } as const;
const HINT = { cut: "draw.cutHint", emboss: "draw.embossHint" } as const;

/**
 * Below (or beside) the drawing area: the brush size – two dots as big as
 * it, black (cuts) and pink (embosses), the pen's ink ringed, a click takes
 * the other (the eraser has one dot, no ink) – and the slider. While moving
 * with nothing selected, a hint instead. As tall as the slider even then: no
 * jumping.
 */
const BrushOptions = ({ shown, brush, onChange, inks, ink, onInk }: Props) => {
  const { t } = useTranslation();
  const size = { "--dot": `${4 + ((brush - 6) / 58) * 16}px` } as CSSProperties;
  // A dot as big as the brush in its box; ringed (springing out from under
  // a gap, like the favorite colors) when it is the ink.
  const dot =
    "grid size-6 shrink-0 place-items-center p-0 after:size-(--dot) after:rounded-full after:bg-(--dot-ink) after:[transition:width_0.15s,height_0.15s,box-shadow_0.45s_var(--ease-spring)]";

  return (
    <div className="flex min-h-9 min-w-0 items-center [grid-area:options]">
      {shown ? (
        <div className="flex max-w-64 min-w-28 flex-1 items-center gap-2.5 @max-[34rem]/draw:max-w-none beside:max-w-72 xl:not-in-data-expanded:min-w-24">
          {inks ? (
            // biome-ignore lint/a11y/useSemanticElements: a pair of toggles, not a form
            <div className="flex shrink-0 items-center gap-1" role="group">
              {(["cut", "emboss"] as const).map((value) => (
                <button
                  aria-label={`${t(LABEL[value])} – ${t(HINT[value])}`}
                  aria-pressed={ink === value}
                  className={`${dot} rounded-full bg-transparent after:[box-shadow:0_0_0_2px_var(--color-card),0_0_0_2px_var(--dot-ink)] hover:after:scale-115 aria-pressed:after:[box-shadow:0_0_0_2px_var(--color-card),0_0_0_3.5px_var(--dot-ink)]`}
                  key={value}
                  onClick={() => onInk(value)}
                  style={
                    {
                      ...size,
                      // Black stays the page's ink colour.
                      "--dot-ink":
                        value === "emboss" ? EMBOSS_INK : "var(--color-ink)",
                    } as CSSProperties
                  }
                  title={`${t(LABEL[value])} – ${t(HINT[value])}`}
                  type="button"
                />
              ))}
            </div>
          ) : (
            <span
              aria-hidden
              className={dot}
              style={
                { ...size, "--dot-ink": "var(--color-ink)" } as CSSProperties
              }
            />
          )}
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
