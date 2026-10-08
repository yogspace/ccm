import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import CookieSlider from "../components/cookie-slider";

type Props = {
  /** The slider – drawing, or something selected to change; else a hint. */
  shown: boolean;
  brush: number;
  onChange: (value: number) => void;
};

/**
 * Below (or beside) the drawing area: the brush size, a dot as big as it
 * next to the slider – while moving with nothing selected, a hint instead.
 * As tall as the slider even then: no jumping.
 */
const BrushOptions = ({ shown, brush, onChange }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-9 min-w-0 items-center [grid-area:options]">
      {shown ? (
        <div className="flex max-w-64 min-w-28 flex-1 items-center gap-3 @max-[34rem]/draw:max-w-none beside:max-w-72 xl:not-in-data-expanded:min-w-24">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center after:size-(--dot) after:rounded-full after:bg-ink after:transition-[width,height] after:duration-150"
            style={
              {
                "--dot": `${4 + ((brush - 6) / 58) * 16}px`,
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
