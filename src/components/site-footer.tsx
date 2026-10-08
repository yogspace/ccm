import { ArrowUpRight } from "lucide-react";
import { cn } from "../cn";
import { useSiteLinks } from "../site-context";
import CookieIcon from "./cookie-icon";
import DonateBadge from "./donate-badge";
import LegalNotice from "./legal-notice";
import { cookieInFooter } from "./styles";

/** A link on the page; its cookie sticks out of the row without making it taller. */
const link =
  "inline-flex items-center gap-0.5 text-on-page transition-[color] hover:underline hover:underline-offset-3";
/** On phones without the separator dots. */
const separator = "max-sm:hidden";

/**
 * The foot of the editor and of the card: the sun to buy a cookie, the links,
 * imprint and credit – no box, a light line across (like the card page's
 * floor), its words right on the page.
 */
type Props = {
  className?: string;
  /** Phones: in a line or two instead of stacked – where room is short. */
  compact?: boolean;
};

const SiteFooter = ({ className, compact = false }: Props) => {
  const links = useSiteLinks();
  // Links and credit; on phones stacked (unless compact).
  const group = cn(
    "inline-flex flex-wrap items-center gap-1.25",
    !compact && "max-sm:flex-col max-sm:items-start max-sm:gap-1.5"
  );

  return (
    // Room on the left for the sun cookie.
    <footer
      className={cn(
        "mt-auto flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-on-page-line pt-3.5 pr-2 pb-1.5 pl-30 text-body text-on-page-muted max-sm:pl-26",
        compact
          ? "max-sm:gap-x-3.5 max-sm:gap-y-0.75 max-sm:pt-2.5 max-sm:text-small"
          : "max-sm:flex-col max-sm:items-start",
        className
      )}
    >
      <DonateBadge />
      <span className={group}>
        <a className={link} href={links.website} rel="noopener" target="_blank">
          mxwr.de
          <CookieIcon
            className={cookieInFooter}
            icon={ArrowUpRight}
            size={40}
          />
        </a>
        <span aria-hidden className={separator}>
          ·
        </span>
        <a
          className={link}
          href={links.makerworld}
          rel="noopener"
          target="_blank"
        >
          MakerWorld
          <CookieIcon
            className={cookieInFooter}
            icing="#5fb36b"
            icon={ArrowUpRight}
            size={40}
          />
        </a>
      </span>
      <span className={group}>
        <LegalNotice />
        <span aria-hidden className={separator}>
          ·
        </span>
        <span>© {new Date().getFullYear()} Maximilian Weber</span>
      </span>
    </footer>
  );
};

export default SiteFooter;
