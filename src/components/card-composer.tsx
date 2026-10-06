import { ArrowLeft, ArrowUpRight, Check, Copy, Share2 } from "lucide-react";
import { type RefObject, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { filamentFor } from "../filaments";
import { GREETING_LIMITS, type Greeting } from "../greeting";
import { creationUrl, greetingLink, store } from "../store";
import { formatLength } from "../units";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";
import RingText from "./ring-text";

type Props = {
  /** The 3D view – it renders the cutter for the little card. */
  preview: RefObject<PreviewHandle | null>;
  greeting: Greeting;
  onChange: (greeting: Greeting) => void;
  onBack: () => void;
};

/** The card's cutter colour – the same the card page picks (by the drawing). */
const cardFilament = () => {
  const { hash } = new URL(creationUrl());
  return filamentFor(new URLSearchParams(hash.slice(1)).get("s") ?? hash);
};

/**
 * “Share as a card”: who it is for, who it is from and a message – the
 * little card above shows how the message runs around the cutter. Then the
 * link to the card's own page.
 */
const CardComposer = ({ preview, greeting, onChange, onBack }: Props) => {
  const { t, i18n } = useTranslation();
  const { name, params, unit } = useSnapshot(store);
  const [picture, setPicture] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ids = useId();
  const title = name.trim() || "Cookie Cutter";
  const lang = i18n.resolvedLanguage ?? "en";

  useEffect(() => {
    const render = preview.current?.renderTop(640, 560, cardFilament());
    setPicture(render?.toDataURL("image/png") ?? null);
  }, [preview]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const set = (field: keyof Greeting) => (value: string) => {
    onChange({ ...greeting, [field]: value });
    setLink(null);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt(t("share.copy"), link);
    }
  };

  const send = () => {
    if (!link) return;
    navigator
      .share({
        title: greeting.to.trim()
          ? t("card.titleFor", { name: greeting.to.trim() })
          : t("card.title"),
        text: t("card.shareText"),
        url: link,
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      });
  };

  return (
    <div className="composer">
      <h2>{t("card.share")}</h2>
      <p>{t("card.intro")}</p>

      {/* The card page in small: the message runs around the cutter. */}
      <div aria-hidden className="composer-preview">
        <RingText text={greeting.message.trim() || t("card.ring")} />
        <div className="composer-card">
          {picture && <img alt="" src={picture} />}
          <div className="composer-name">
            <span>{title}</span>
            <small>
              {formatLength(params.size, unit, lang, unit === "in" ? 1 : 0)}
            </small>
          </div>
        </div>
      </div>

      <div className="composer-names">
        <label className="composer-field" htmlFor={`${ids}-to`}>
          <span>{t("card.to")}</span>
          <input
            autoComplete="off"
            id={`${ids}-to`}
            maxLength={GREETING_LIMITS.name}
            onChange={(event) => set("to")(event.target.value)}
            placeholder={t("card.toPlaceholder")}
            value={greeting.to}
          />
        </label>
        <label className="composer-field" htmlFor={`${ids}-from`}>
          <span>{t("card.from")}</span>
          <input
            autoComplete="name"
            id={`${ids}-from`}
            maxLength={GREETING_LIMITS.name}
            onChange={(event) => set("from")(event.target.value)}
            placeholder={t("card.fromPlaceholder")}
            value={greeting.from}
          />
        </label>
      </div>
      <label className="composer-field" htmlFor={`${ids}-message`}>
        <span>
          {t("card.message")}
          <small>
            {greeting.message.length} / {GREETING_LIMITS.message}
          </small>
        </span>
        <textarea
          id={`${ids}-message`}
          maxLength={GREETING_LIMITS.message}
          onChange={(event) => set("message")(event.target.value)}
          placeholder={t("card.messagePlaceholder")}
          rows={3}
          value={greeting.message}
        />
      </label>

      {link ? (
        <>
          <p className="composer-ready">{t("card.ready")}</p>
          <Button
            aria-label={copied ? t("share.copied") : t("share.copy")}
            className="share-link"
            data-copied={copied || undefined}
            onClick={copy}
            title={t("share.copy")}
            type="button"
          >
            <span aria-live="polite" className="share-url">
              {copied ? t("share.copied") : link}
            </span>
            {copied ? (
              <CookieIcon icing="#00b86b" icon={Check} key="ok" size={44} />
            ) : (
              <CookieIcon icing="#2a44ff" icon={Copy} key="copy" size={44} />
            )}
          </Button>
          <div className="share-more">
            <Button
              onClick={() => window.open(link, "_blank", "noopener")}
              type="button"
            >
              <CookieIcon
                icing="#2a44ff"
                icon={ArrowUpRight}
                roll={-8}
                size={48}
              />
              {t("card.open")}
            </Button>
            {"share" in navigator && (
              <Button className="primary" onClick={send} type="button">
                <CookieIcon icon={Share2} roll={10} size={48} />
                {t("card.send")}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="share-more">
          <Button className="ghost" onClick={onBack} type="button">
            <CookieIcon icing="#2a44ff" icon={ArrowLeft} size={40} />
            {t("card.back")}
          </Button>
          <Button
            className="primary"
            onClick={() => setLink(greetingLink(greeting))}
            type="button"
          >
            <CookieIcon icon={Check} roll={-8} size={48} />
            {t("card.create")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CardComposer;
