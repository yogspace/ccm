import { Check, Link, Mail, Share2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SimpleIcon, siTelegram, siWhatsapp } from "simple-icons";
import Button from "./button";
import CookieIcon from "./cookie-icon";

type Props = {
  /** Teilbarer Link – ohne Form einfach die Seite. */
  url: string;
  name: string;
};

const BrandIcon = ({ icon }: { icon: SimpleIcon }) => (
  <svg
    aria-hidden
    fill="currentColor"
    height={15}
    viewBox="0 0 24 24"
    width={15}
  >
    <path d={icon.path} />
  </svg>
);

/** Kompakte Teilen-Leiste: Link kopieren, Messenger, E-Mail, System-Menü. */
const SharePanel = ({ url, name }: Props) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const title = name.trim() || "Cookie Cutter Maker";
  const text = t("share.text");
  const encode = encodeURIComponent;

  const targets: {
    key: string;
    label: string;
    href: string;
    icon: ReactNode;
  }[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encode(`${text} ${url}`)}`,
      icon: <BrandIcon icon={siWhatsapp} />,
    },
    {
      key: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encode(url)}&text=${encode(text)}`,
      icon: <BrandIcon icon={siTelegram} />,
    },
    {
      key: "mail",
      label: t("share.mail"),
      href: `mailto:?subject=${encode(title)}&body=${encode(`${text}\n${url}`)}`,
      icon: <Mail aria-hidden size={15} />,
    },
  ];

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
      await navigator.share({ title, text, url });
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
      <div className="share-targets">
        {targets.map(({ key, label, href, icon }) => (
          <a
            aria-label={t("share.via", { target: label })}
            className="share-target"
            data-target={key}
            href={href}
            key={key}
            rel="noopener"
            target="_blank"
            title={t("share.via", { target: label })}
          >
            {icon}
          </a>
        ))}
        {canShare && (
          <Button
            aria-label={t("share.more")}
            className="share-target"
            onClick={share}
            title={t("share.more")}
            type="button"
          >
            <Share2 aria-hidden size={15} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default SharePanel;
