import { Eraser, Move, Pencil, PenTool } from "lucide-react";
import { motion } from "motion/react";
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import { cookieInIconButton, cookieToggle } from "../components/styles";
import type { Tool } from "../store";

type Props = {
  tool: Tool;
  onChoose: (tool: Tool) => void;
};

const TOOLS = [
  ["pen", Pencil, "#ffc31f", -20, "draw.pen", "P"],
  ["line", PenTool, "#ff6a1f", -14, "draw.line", "L"],
  ["eraser", Eraser, "#ff5fa8", -24, "draw.eraser", "E"],
  ["move", Move, "#2a44ff", 0, "draw.move", "V"],
] as const;

/**
 * Pen, line, eraser, move – the active one is underlined, the line glides
 * to the new one (editing a line's points belongs to moving). Each has its
 * key (use-keys.ts), told in its title. Memoised
 * because `motion` measures the layout on every render; that should not
 * happen on every slider move.
 */
const ToolPicker = ({ tool, onChoose }: Props) => {
  const { t } = useTranslation();
  const id = useId();

  return (
    // Flush with the drawing area's left edge, whatever stands next to it.
    // Beside the area (draw-canvas.tsx) the tools stand on top of each other.
    // biome-ignore lint/a11y/useSemanticElements: a group of toggles, not a form
    <div
      aria-label={t("draw.tools")}
      className="flex items-center gap-2.5 [grid-area:tools] justify-self-start @max-[34rem]/draw:gap-2 beside:flex-col beside:gap-3 beside:self-start beside:justify-self-center"
      role="group"
    >
      {TOOLS.map(([value, icon, icing, roll, label, key]) => {
        const active =
          tool === value || (value === "move" && tool === "points");
        return (
          <Button
            aria-keyshortcuts={key}
            aria-label={t(label)}
            aria-pressed={active}
            className="relative"
            key={value}
            kind="icon"
            onClick={() => onChoose(value)}
            title={`${t(label)} (${key})`}
            type="button"
          >
            <CookieIcon
              className={cn(cookieInIconButton, cookieToggle)}
              icing={icing}
              icon={icon}
              roll={roll}
              size={50}
            />
            {/* Below the active tool – stacked, to its left. */}
            {active && (
              <motion.span
                aria-hidden
                className="absolute -bottom-2.5 left-1/2 -ml-3 h-1 w-6 rounded-xs bg-accent beside:top-1/2 beside:bottom-auto beside:-left-2.5 beside:m-0 beside:-mt-3 beside:h-6 beside:w-1"
                layoutId={`${id}-tool`}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
              />
            )}
          </Button>
        );
      })}
    </div>
  );
};

export default memo(ToolPicker);
