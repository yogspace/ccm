/** Tailwind classes shared by several components. */

/**
 * A 3D cookie (cookie-icon.tsx) is drawn larger than the row it sits in –
 * these margins let it stick out without making the row taller.
 */
export const cookieInButton = "-my-4 -mr-1 -ml-3";
/** An icon button is just its cookie. */
export const cookieInIconButton = "-m-2.5";
/** In the footer and the imprint dialog, which opens from it. */
export const cookieInFooter = "-my-3 -mr-2 -ml-1";
/** Beside a short line of text, e.g. the dimensions or the unit switch. */
export const cookieInLine = "-my-3 -mr-1 -ml-2";

/** Toggled off (turntable, tools): the cookie fades. */
export const cookieToggle =
  "in-aria-[pressed=false]:opacity-50 in-aria-[pressed=false]:grayscale-70";

/**
 * A stage: the drawing area and the 3D view. It stays a light sheet in both
 * themes (`paper`, index.css).
 */
export const stage =
  "paper relative flex-none overflow-hidden rounded-2xl bg-paper text-ink [transition:border-color_0.2s_var(--ease-soft),background-color_0.2s_var(--ease-soft),transform_0.3s_var(--ease-spring)]";

/** A hint lying on a stage (drawing area, 3D view) while it is empty. */
export const stageHint =
  "pointer-events-none absolute inset-0 flex animate-[fade_0.4s_var(--ease-soft)] flex-col items-center justify-center gap-1 p-8 text-center text-muted";
export const cookieInStageHint = "-mt-3 -mb-1";

/**
 * Popovers in neon pink (printing tips, errors), in the top layer. Where the
 * browser supports anchor positioning they sit next to their anchor and move
 * to where there is room; elsewhere they stay centred like any popover.
 */
export const popup =
  "m-auto max-w-[min(26rem,100vw-2rem)] translate-y-1.5 rounded-2xl bg-neon px-5 py-4 text-body font-bold text-on-neon opacity-0 shadow-[0_1rem_2.5rem_rgb(5_10_60/0.3)] text-shadow-[0_1px_2px_rgb(110_0_70/0.35)] transition-[opacity,translate,display,overlay] transition-discrete open:translate-y-0 open:opacity-100 starting:open:translate-y-1.5 starting:open:opacity-0 supports-[anchor-name:--a]:inset-auto supports-[anchor-name:--a]:m-2 supports-[anchor-name:--a]:[position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]";

/** The text fields of the card composer and the contact form (field.tsx). */
export const fieldInput =
  "w-full rounded-lg bg-field px-3.5 py-2 text-body font-semibold text-field-ink outline-2 outline-transparent transition-[outline-color,background-color] placeholder:font-medium placeholder:text-field-muted focus:bg-paper focus:outline-accent";

/*
 * The share box (share-creation.tsx) – as a picture and as a greeting card
 * (card-composer.tsx): the picture or the little card on the left, the rest
 * beside it.
 */

/** The picture or the little card – square; swapped, it scales in. */
export const shareVisual =
  "mx-auto aspect-square w-full max-w-80 animate-[pop-in_0.5s_var(--ease-spring)_both] self-start max-sm:max-w-64";
export const shareContent = "flex min-w-0 flex-col gap-3";
export const shareIntro = "text-muted";
/** The link as a field – a click copies it, the copy icon on the right. */
export const shareLink =
  "mt-2 h-11 w-full justify-between gap-3 bg-field pr-2.5 pl-4 text-small font-medium text-field-ink data-copied:font-bold";
export const shareUrl = "min-w-0 truncate";
/** The box's actions, right-aligned at its foot – level in both boxes. */
export const shareMore =
  "mt-auto flex flex-wrap justify-end gap-x-4 gap-y-2.5 pt-1";
/** Ghost: a soft shine running over a picture's kept place while it renders. */
export const ghost =
  "animate-[ghost_1.3s_ease-in-out_infinite] bg-[linear-gradient(100deg,transparent_30%,rgb(255_255_255/0.65)_50%,transparent_70%)] bg-size-[250%_100%] motion-reduce:animate-none";
/** The message running around the card in small, slowly turning like a record. */
export const ringOnGlaze =
  "absolute inset-[3%] size-[94%] overflow-visible fill-on-glaze font-semibold whitespace-pre motion-reduce:animate-none";
