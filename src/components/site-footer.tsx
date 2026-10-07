import { ArrowUpRight } from "lucide-react";
import { useSiteLinks } from "../site-context";
import CookieIcon from "./cookie-icon";
import DonateBadge from "./donate-badge";
import LegalNotice from "./legal-notice";

/**
 * The foot of the editor and of the card: the sun to buy a cookie, the links,
 * imprint and credit – no box, a light line above it.
 */
const SiteFooter = () => {
  const links = useSiteLinks();

  return (
    <footer>
      <DonateBadge />
      <span className="footer-links">
        <a href={links.website} rel="noopener" target="_blank">
          mxwr.de
          <CookieIcon icon={ArrowUpRight} size={40} />
        </a>
        <span aria-hidden className="sep">
          ·
        </span>
        <a href={links.makerworld} rel="noopener" target="_blank">
          MakerWorld
          <CookieIcon icing="#5fb36b" icon={ArrowUpRight} size={40} />
        </a>
      </span>
      <span className="credit">
        <LegalNotice />
        <span aria-hidden className="sep">
          ·
        </span>
        <span>© {new Date().getFullYear()} Maximilian Weber</span>
      </span>
    </footer>
  );
};

export default SiteFooter;
