import type { ComponentProps, CSSProperties } from "react";
import { cn } from "../cn";
import { SITE_LINE } from "./card-image";
import { ghost } from "./styles";

type Props = ComponentProps<"div"> & {
  /** The favourite colour – the picture in its shades (glaze.css). */
  glaze: string;
  name: string;
  /** The cutter is on its way: its place is kept, a shine runs over it. */
  waiting?: boolean;
};

/**
 * The share picture, built of the page: the favourite colour, the card with
 * the cutter from above (the children), below it the name and where it was
 * made. paintSharePicture (card-image.ts) paints it the same, 1200 px wide:
 * 12 px there are 1cqw here. Name and site sit on the baselines they are
 * painted on (1060 and 1130) – Pally's lies --baseline below the top of a
 * line as high as its font. In the share box and the gallery's fan.
 */
const SharePicture = ({
  glaze,
  name,
  waiting = false,
  className,
  style,
  children,
  ...props
}: Props) => (
  <div
    className={cn(
      "glaze relative overflow-hidden rounded-2xl bg-glaze text-on-glaze @container",
      className
    )}
    style={{ ...style, "--glaze": glaze } as CSSProperties}
    {...props}
  >
    <div
      className={cn(
        "absolute top-[5cqw] left-[5cqw] h-[73.333cqw] w-[90cqw] overflow-hidden rounded-[4cqw] bg-card-sheet",
        waiting && ghost
      )}
    >
      {children}
    </div>
    <strong className="absolute top-[calc(88.333cqw-var(--baseline))] left-[5cqw] w-[90cqw] truncate text-[6.333cqw] leading-none font-bold [--baseline:0.813em]">
      {name}
    </strong>
    <small className="absolute top-[calc(94.167cqw-var(--baseline))] left-[5cqw] w-[90cqw] truncate text-[3.167cqw] leading-none font-medium text-on-glaze-muted [--baseline:0.813em]">
      {SITE_LINE}
    </small>
  </div>
);

export default SharePicture;
