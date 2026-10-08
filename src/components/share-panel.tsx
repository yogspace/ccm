import { Check, Link, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { pageUrl, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInButton } from "./styles";

/**
 * Sharing the page itself, right behind the title in the header: the system
 * share menu where there is one, otherwise copying the link.
 */
const SharePanel = () => {
  const { t } = useTranslation();
  const { name } = useSnapshot(store);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const url = pageUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard access the link in the address bar still works.
      window.prompt(t("share.copy"), url);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: name.trim() || "Cookie Cutter Maker",
        // Apps append the link – on its own line, not stuck to the text.
        text: `${t("share.pageText")}\n`,
        url: pageUrl(),
      });
    } catch (error) {
      // Cancelling the share menu is not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      copy();
    }
  };

  // One button: the system share menu where there is one – otherwise copy the
  // link. No surface, just a link on the blue page – its cookie and its words.
  return (
    <div className="flex items-center transition-opacity">
      <Button
        className="h-auto gap-1.5 bg-transparent p-0 font-bold text-on-page hover:enabled:underline hover:enabled:decoration-[0.1em] hover:enabled:underline-offset-[0.2em] data-copied:text-on-page-muted"
        data-copied={copied || undefined}
        onClick={canShare ? share : copy}
        type="button"
      >
        {copied ? (
          <CookieIcon
            className={cookieInButton}
            icing="#00b86b"
            icon={Check}
            key="check"
            size={52}
          />
        ) : canShare ? (
          <CookieIcon
            className={cookieInButton}
            icon={Share2}
            key="share"
            roll={14}
            size={52}
          />
        ) : (
          <CookieIcon
            className={cookieInButton}
            icon={Link}
            key="link"
            roll={-22}
            size={52}
          />
        )}
        <span aria-live="polite">
          {copied
            ? t("share.copied")
            : canShare
              ? t("share.sharePage")
              : t("share.copy")}
        </span>
      </Button>
    </div>
  );
};

export default SharePanel;
