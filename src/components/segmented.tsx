import { motion } from "motion/react";
import { type PropsWithChildren, type ReactNode, useId } from "react";
import { cn } from "../cn";

/**
 * Where the switch sits: on the blue page (the header's unit and language –
 * only the unselected option lightens on hover, the selected one sits on the
 * white marker and keeps its blue text) or on a card.
 */
const tones = {
  page: {
    group: "items-center bg-on-page-soft",
    button:
      "h-7 rounded-lg tracking-wider text-on-page-muted not-aria-pressed:hover:enabled:text-on-page aria-pressed:text-page",
    pill: "bg-on-page",
  },
  card: {
    group: "bg-surface-2",
    button:
      "h-9 px-3.5 text-muted hover:enabled:text-ink aria-pressed:text-accent",
    pill: "bg-accent-soft",
  },
};

type Props<T extends string> = PropsWithChildren<{
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  tone: keyof typeof tones;
  className?: string;
}>;

/** Switch whose marker glides to the chosen option. `children` come first (e.g. an icon). */
const Segmented = <T extends string>({
  label,
  options,
  value,
  onChange,
  tone,
  className,
  children,
}: Props<T>) => {
  const id = useId();
  const styles = tones[tone];

  return (
    <fieldset
      aria-label={label}
      className={cn("flex gap-0.5 rounded-xl p-1", styles.group, className)}
    >
      {children}
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={cn(
            "relative h-8 bg-transparent px-2 text-small",
            styles.button
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.value === value && (
            <motion.span
              className={cn("absolute inset-0 rounded-[inherit]", styles.pill)}
              layoutId={`${id}-pill`}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            />
          )}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </fieldset>
  );
};

export default Segmented;
