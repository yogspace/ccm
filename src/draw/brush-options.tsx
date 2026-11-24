import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import CookieSlider from "../components/cookie-slider";
import Segmented from "../components/segmented";
import { EMBOSS_INK, type Ink } from "../drawing";

type Props = {
  /**
   * Drawing, or something selected to change. Else (moving, nothing picked)
   * the room stays, empty – the move tool's hint is on the area.
   */
  shown: boolean;
  brush: number;
  /** The brush's width on the drawing area right now, in CSS px. */
  dot: number;
  onChange: (value: number) => void;
  /** The ink can change – for the pen, or something selected to recolour. */
  inks: boolean;
  ink: Ink;
  onInk: (ink: Ink) => void;
};

const LABEL = { cut: "draw.cut", emboss: "draw.emboss" } as const;
const HINT = { cut: "draw.cutHint", emboss: "draw.embossHint" } as const;

/** Larger than this (only when zoomed in) the dot would reach the slider. */
const MAX_DOT = 64;

/**
 * Below the drawing area: the ink and the brush size. On top the inks as a
 * switch with their names – “Cut out”, “Emboss”: what each does is read,
 * not guessed from a colour (the hint as tooltip) – and before it one dot
 * exactly as wide as a stroke on the area, in the ink it draws with (the
 * eraser has the dot alone, in the same place). Below, the slider. The dot grows in a box of
 * its own, out of the flow: dragging the slider moves nothing – nor the
 * measured height the area is sized by (use-area-fit.ts). While moving with
 * nothing selected it keeps its room, empty, so nothing jumps – the move
 * tool's hint stands on the area like the line tool's (draw-canvas.tsx).
 */
const BrushOptions = ({
  shown,
  brush,
  dot,
  onChange,
  inks,
  ink,
  onInk,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div className="grid min-w-0 items-center [grid-area:options]">
      <div
        className={cn(
          "col-start-1 row-start-1 flex min-w-0 flex-col gap-3",
          !shown && "invisible"
        )}
        inert={!shown}
      >
        {/* As tall as the switch even without it (the eraser). */}
        <div className="flex min-h-11 items-center gap-3">
          {/* First, at a fixed place: the eraser (no switch) moves nothing.
              Centred in its box, which is as wide as the largest dot. */}
          <span aria-hidden className="relative h-11 w-16 shrink-0">
            <span
              className="absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-(--dot-ink) [transition:background-color_0.2s]"
              style={
                {
                  width: `${Math.min(MAX_DOT, Math.max(2, dot))}px`,
                  height: `${Math.min(MAX_DOT, Math.max(2, dot))}px`,
                  // Black stays the page's ink colour.
                  "--dot-ink":
                    inks && ink === "emboss" ? EMBOSS_INK : "var(--color-ink)",
                } as CSSProperties
              }
            />
          </span>
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
    </div>
  );
};

export default BrushOptions;
