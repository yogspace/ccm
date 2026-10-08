import type { ComponentProps } from "react";
import { cn } from "../cn";

/**
 * A card on the page: subtle cream, flat, without outlines – in the dark
 * translucent, the background cookies shine through faintly. Not blurred:
 * a blur over cookies that move flickers while the page scrolls. Cards
 * rise in one after another.
 */
export const Card = ({ className, ...props }: ComponentProps<"section">) => (
  <section
    className={cn(
      "flex animate-rise flex-col gap-5 rounded-3xl bg-card px-7 pt-6 pb-7 text-ink nth-2:[animation-delay:0.06s] nth-3:[animation-delay:0.12s] max-sm:px-4",
      className
    )}
    {...props}
  />
);

/** The card's head: its title on the left, its tools on the right. */
export const CardHead = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn("flex min-h-9 items-center justify-between gap-4", className)}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }: ComponentProps<"h2">) => (
  <h2
    className={cn(
      "flex items-center gap-2.5 text-title leading-none font-bold tracking-title embolden-20",
      className
    )}
    {...props}
  />
);
