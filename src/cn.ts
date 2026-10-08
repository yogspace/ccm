import { type ClassNameValue, extendTailwindMerge } from "tailwind-merge";

/** Knows the theme's own font sizes – `text-small` is a size, not a colour. */
const merge = extendTailwindMerge({
  extend: { theme: { text: ["tiny", "small", "body", "title", "display"] } },
});

/**
 * Class names joined, empty ones left out; of two utilities that set the
 * same thing the later one wins – so a component's classes can be adjusted
 * where it is used.
 */
export const cn = (...classes: ClassNameValue[]) => merge(classes) || undefined;
