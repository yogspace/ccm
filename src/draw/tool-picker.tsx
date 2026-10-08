import { Eraser, Move, Pencil } from "lucide-react";
import { motion } from "motion/react";
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import type { Tool } from "../store";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import { cookieInIconButton, cookieToggle } from "../components/styles";

type Props = {
  tool: Tool;
  onChoose: (tool: Tool) => void;
};

const TOOLS = [
  ["pen", Pencil, "#ffc31f", -20, "draw.pen"],
  ["eraser", Eraser, "#ff5fa8", -24, "draw.eraser"],
  ["move", Move, "#2a44ff", 0, "draw.move"],
] as const;

/**
 * Pen, eraser, move – the active one is underlined, the line glides to the
 * new one. Memoised because `motion` measures the layout on every render;
 * that should not happen on every slider move.
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
      {TOOLS.map(([value, icon, icing, roll, label]) => (
        <Button
          aria-label={t(label)}
          aria-pressed={tool === value}
          className="relative"
          key={value}
          kind="icon"
          onClick={() => onChoose(value)}
          title={t(label)}
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
          {tool === value && (
            <motion.span
              aria-hidden
              className="absolute -bottom-2.5 left-1/2 -ml-3 h-1 w-6 rounded-xs bg-accent beside:top-1/2 beside:bottom-auto beside:-left-2.5 beside:m-0 beside:-mt-3 beside:h-6 beside:w-1"
              layoutId={`${id}-tool`}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            />
          )}
        </Button>
      ))}
    </div>
  );
};

export default memo(ToolPicker);
