import { type HTMLMotionProps, motion } from "motion/react";
import { cn } from "../cn";

const spring = { type: "spring", stiffness: 500, damping: 28 } as const;

/**
 * The kinds of button. A plain one has the look every button gets
 * (index.css); these change it.
 */
const kinds = {
  /** The main action, in the accent color. */
  primary:
    "bg-accent text-on-accent hover:enabled:bg-[color-mix(in_oklab,var(--color-accent)_86%,#000)]",
  /** Quiet: no surface until hovered. */
  ghost:
    "h-8 bg-transparent px-2.5 text-muted hover:enabled:bg-surface-2 hover:enabled:text-ink",
  /** Just its floating cookie, no surface behind it. */
  icon: "w-9 bg-transparent p-0",
  /** Only its words, like a link. */
  link: "h-auto bg-transparent p-0 font-normal text-muted hover:enabled:text-ink",
} as const;

type Props = HTMLMotionProps<"button"> & { kind?: keyof typeof kinds };

/** Button with a springy hover and press – used everywhere instead of `<button>`. */
const Button = ({ kind, className, ...props }: Props) => (
  <motion.button
    className={cn(kind && kinds[kind], className)}
    transition={spring}
    whileHover={props.disabled ? undefined : { y: -1.5 }}
    whileTap={props.disabled ? undefined : { scale: 0.93 }}
    {...props}
  />
);

export default Button;
