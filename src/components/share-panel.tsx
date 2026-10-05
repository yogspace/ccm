import { Check, Link, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./button";
import CookieIcon from "./cookie-icon";

type Props = {
  /** Teilbarer Link – ohne Form einfach die Seite. */
  url: string;
  name: string;
};

/** Kompakte Teilen-Leiste: Link kopieren und (wo vorhanden) das System-Menü. */
const SharePanel = ({ url, name }: Props) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
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
        text: t("share.text"),
        url,
      });
    } catch (error) {
      // Abbrechen im Teilen-Menü ist kein Fehler.
      if (error instanceof DOMException && error.name === "AbortError") return;
      copy();
    }
  };

  return (
    <div className="share">
      <span className="share-label">{t("share.title")}</span>
      <Button
        className="copy"
        data-copied={copied || undefined}
        onClick={copy}
        type="button"
      >
        {copied ? (
          <Check aria-hidden key="check" size={15} />
        ) : (
          <CookieIcon icon={Link} key="link" roll={-22} size={52} />
        )}
        <span aria-live="polite">
          {copied ? t("share.copied") : t("share.copy")}
        </span>
      </Button>
      {canShare && (
        <Button
          aria-label={t("share.more")}
          className="icon"
          onClick={share}
          title={t("share.more")}
          type="button"
        >
          <CookieIcon icing="#2a44ff" icon={Share2} roll={14} size={52} />
        </Button>
      )}
    </div>
  );
};

export default SharePanel;
