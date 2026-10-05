import { Check, Link, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { pageUrl, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** Teilen der Seite selbst: System-Teilen-Menü, wo vorhanden, sonst Link kopieren. */
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
      // Ohne Clipboard-Zugriff bleibt der Link in der Adresszeile nutzbar.
      window.prompt(t("share.copy"), url);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: name.trim() || "Cookie Cutter Maker",
        text: t("share.pageText"),
        url: pageUrl(),
      });
    } catch (error) {
      // Abbrechen im Teilen-Menü ist kein Fehler.
      if (error instanceof DOMException && error.name === "AbortError") return;
      copy();
    }
  };

  // Ein Button: System-Teilen-Menü, wo es das gibt – sonst Link kopieren.
  return (
    <div className="share">
      <Button
        className="copy"
        data-copied={copied || undefined}
        onClick={canShare ? share : copy}
        type="button"
      >
        {copied ? (
          <CookieIcon icing="#00b86b" icon={Check} key="check" size={52} />
        ) : canShare ? (
          <CookieIcon icon={Share2} key="share" roll={14} size={52} />
        ) : (
          <CookieIcon icon={Link} key="link" roll={-22} size={52} />
        )}
        <span aria-live="polite">
          {copied
            ? t("share.copied")
            : canShare
              ? t("share.share")
              : t("share.copy")}
        </span>
      </Button>
    </div>
  );
};

export default SharePanel;
