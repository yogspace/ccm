import { Eraser, Move, Pencil } from "lucide-react";
import { motion } from "motion/react";
import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** Werkzeug: malen, radieren oder Formen verschieben. */
export type Tool = "pen" | "eraser" | "move";

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
 * Stift, Radiergummi, Verschieben – das aktive ist unterstrichen, der Strich
 * gleitet zum neuen. Memoisiert, weil `motion` beim Neuzeichnen das Layout
 * misst; das soll nicht bei jeder Reglerbewegung passieren.
 */
const ToolPicker = ({ tool, onChoose }: Props) => {
  const { t } = useTranslation();
  const id = useId();

  return (
    // biome-ignore lint/a11y/useSemanticElements: Gruppe von Umschaltern, kein Formular
    <div aria-label={t("draw.tools")} className="tool-group" role="group">
      {TOOLS.map(([value, icon, icing, roll, label]) => (
        <Button
          aria-label={t(label)}
          aria-pressed={tool === value}
          className="icon toggle tool"
          key={value}
          onClick={() => onChoose(value)}
          title={t(label)}
          type="button"
        >
          <CookieIcon icing={icing} icon={icon} roll={roll} size={50} />
          {tool === value && (
            <motion.span
              aria-hidden
              className="tool-underline"
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
