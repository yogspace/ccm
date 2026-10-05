import { type HTMLMotionProps, motion } from "motion/react";

const spring = { type: "spring", stiffness: 500, damping: 28 } as const;

/** Button mit federndem Hover und Druck – überall statt `<button>`. */
const Button = (props: HTMLMotionProps<"button">) => (
  <motion.button
    transition={spring}
    whileHover={props.disabled ? undefined : { y: -1.5 }}
    whileTap={props.disabled ? undefined : { scale: 0.93 }}
    {...props}
  />
);

export default Button;
