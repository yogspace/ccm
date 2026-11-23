import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import CookieSlider from "../components/cookie-slider";
import Segmented from "../components/segmented";
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
 * Below (or beside) the drawing area: the ink and the brush size. On top
 * the inks as a switch with their names – “Cut out”, “Emboss”: what each
 * does is read, not guessed from a colour (the hint as tooltip) – and
 * beside it one dot as big as the brush, in the ink it draws with (the
 * eraser has the dot alone). Below, the slider. While moving with nothing
 * selected, a hint instead – in the same room, so nothing jumps.
 */
const BrushOptions = ({ shown, brush, onChange, inks, ink, onInk }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="grid min-w-0 items-center [grid-area:options]">
      <div
        className={cn(
          "col-start-1 row-start-1 flex min-w-28 max-w-80 flex-col gap-3 @max-[34rem]/draw:max-w-none xl:not-in-data-expanded:min-w-24",
          !shown && "invisible"
        )}
        inert={!shown}
      >
        {/* As tall as the switch even without it (the eraser). */}
        <div className="flex min-h-11 items-center gap-3">
          {inks && (
            <Segmented
              className="shrink-0"
              label={t("draw.ink")}
              onChange={onInk}
              options={(["cut", "emboss"] as const).map((value) => ({
                value,
                title: t(HINT[value]),
                label: t(LABEL[value]),
              }))}
              tone="card"
              value={ink}
            />
          )}
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center after:size-(--dot) after:rounded-full after:bg-(--dot-ink) after:[transition:width_0.15s,height_0.15s,background-color_0.2s]"
            style={
              {
                "--dot": `${4 + ((brush - 6) / 58) * 16}px`,
                // Black stays the page's ink colour.
                "--dot-ink":
                  inks && ink === "emboss" ? EMBOSS_INK : "var(--color-ink)",
              } as CSSProperties
            }
          />
        </div>
        <div className="flex">
          <CookieSlider
            label={t("draw.brush")}
            max={64}
            min={6}
            onChange={onChange}
            step={1}
            value={brush}
          />
        </div>
      </div>
      {!shown && (
        <span
          className="col-start-1 row-start-1 min-w-0 truncate text-small text-muted"
          title={t("draw.moveHint")}
        >
          {t("draw.moveHint")}
        </span>
      )}
    </div>
  );
};

export default BrushOptions;
