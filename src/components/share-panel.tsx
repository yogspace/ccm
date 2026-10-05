import { Check, Link, Mail, Share2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SimpleIcon, siTelegram, siWhatsapp } from "simple-icons";

type Props = {
  /** Teilbarer Link, `null` solange es noch keine Form gibt. */
  url: string | null;
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
      href: `https://t.me/share/url?url=${encode(url ?? "")}&text=${encode(text)}`,
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
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Ohne Clipboard-Zugriff bleibt der Link in der Adresszeile nutzbar.
      window.prompt(t("share.copy"), url);
    }
  };

  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      // Abbrechen im Teilen-Menü ist kein Fehler.
      if (error instanceof DOMException && error.name === "AbortError") return;
      copy();
    }
  };

  return (
    <div
      className="share"
      data-empty={!url || undefined}
      title={url ? undefined : t("share.empty")}
    >
      <h3>{t("share.title")}</h3>
      <button
        className="copy"
        data-copied={copied || undefined}
        disabled={!url}
        onClick={copy}
        type="button"
      >
        {copied ? (
          <Check aria-hidden key="check" size={15} />
        ) : (
          <Link aria-hidden key="link" size={15} />
        )}
        <span aria-live="polite">
          {copied ? t("share.copied") : t("share.copy")}
        </span>
      </button>
      <div className="share-targets">
        {targets.map(({ key, label, href, icon }) =>
          url ? (
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
          ) : (
            // Ohne Form gibt es noch nichts zu teilen – gleiche Optik, aber inaktiv.
            <button
              aria-label={t("share.via", { target: label })}
              className="share-target"
              disabled
              key={key}
              type="button"
            >
              {icon}
            </button>
          )
        )}
        {canShare && (
          <button
            aria-label={t("share.more")}
            className="share-target"
            disabled={!url}
            onClick={share}
            title={t("share.more")}
            type="button"
          >
            <Share2 aria-hidden size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SharePanel;
