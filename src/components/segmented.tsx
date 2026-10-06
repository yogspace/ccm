import { motion } from "motion/react";
import { type PropsWithChildren, type ReactNode, useId } from "react";

type Props<T extends string> = PropsWithChildren<{
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}>;

/** Switch whose marker glides to the chosen option. `children` come first (e.g. an icon). */
const Segmented = <T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  children,
}: Props<T>) => {
  const id = useId();

  return (
    <fieldset
      aria-label={label}
      className={["switch", className].filter(Boolean).join(" ")}
    >
      {children}
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.value === value && (
            <motion.span
              className="switch-pill"
              layoutId={`${id}-pill`}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
            />
          )}
          <span className="switch-label">{option.label}</span>
        </button>
      ))}
    </fieldset>
  );
};

export default Segmented;
