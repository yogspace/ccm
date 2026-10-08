import { ArrowUpRight, Check, Copy, Share2 } from "lucide-react";
import { type CSSProperties, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { GREETING_LIMITS, type Greeting } from "../greeting";
import { useCardColor } from "../site-context";
import { creationUrl, greetingLink, store } from "../store";
import { formatLength } from "../units";
import Button from "./button";
import CanvasView from "./canvas-view";
import ColorSwatches from "./color-swatches";
import CookieIcon from "./cookie-icon";
import RingText from "./ring-text";

type Props = {
  greeting: Greeting;
  onChange: (greeting: Greeting) => void;
  /**
   * The cutter from above in the favourite colour (share-creation.tsx
   * renders it).
   */
  picture: HTMLCanvasElement | null;
};

/**
 * The share box as a greeting card (share-creation.tsx): beside the little
 * card – the message running around the cutter – who it is for, who it is
 * from and the message. Then the link to the card's own page.
 */
const CardComposer = ({ greeting, onChange, picture }: Props) => {
  const { t, i18n } = useTranslation();
  const { cutter, name, params, unit } = useSnapshot(store);
  /** The card's link – and the creation it was made for. */
  const [created, setCreated] = useState<{
    link: string;
    creation: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const ids = useId();
  const title = name.trim() || "Cookie Cutter";
  const canSend = "share" in navigator;
  const lang = i18n.resolvedLanguage ?? "en";
  // The favourite colour from the CMS; an unknown number is the first.
  const { chosen, glaze } = useCardColor(greeting.color);
  const creation = creationUrl();
  // Drawn on since: the card is made anew.
  const link = created?.creation === creation ? created.link : null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const set = (field: "to" | "from" | "message") => (value: string) => {
    onChange({ ...greeting, [field]: value });
    setCreated(null);
  };

  const pick = (color: number) => {
    onChange({ ...greeting, color });
    setCreated(null);
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
    <>
      {/* The card page in small, in the favourite colour: the message runs
          around the cutter. Its place is kept while the cutter renders. */}
      <div
        aria-hidden
        className="share-visual composer-preview glaze"
        style={{ "--glaze": glaze } as CSSProperties}
      >
        <RingText text={greeting.message.trim() || t("card.ring")} />
        <div className="composer-card">
          {picture ? (
            <CanvasView canvas={picture} />
          ) : (
            <span
              className="composer-ghost"
              data-waiting={!!cutter.mesh || undefined}
            />
          )}
          <div className="composer-name">
            <span>{title}</span>
            <small>
              {formatLength(params.size, unit, lang, unit === "in" ? 1 : 0)}
            </small>
          </div>
        </div>
      </div>

      <div className="share-content composer">
        <p className="share-intro">{t("card.intro")}</p>
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
            placeholder={t("card.ring")}
            rows={3}
            value={greeting.message}
          />
        </label>
        {/* The favourite colour: the page, the card, its words, the cutter
            and the cookie's icing in its shades. */}
        <ColorSwatches onChange={pick} value={chosen} />

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
                className={canSend ? undefined : "primary"}
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
              {canSend && (
                <Button className="primary" onClick={send} type="button">
                  <CookieIcon icon={Share2} roll={10} size={48} />
                  {t("card.send")}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="share-more">
            <Button
              className="primary"
              disabled={!cutter.mesh}
              onClick={() => {
                setCreated({ link: greetingLink(greeting, lang), creation });
                trackEvent("card-created");
              }}
              type="button"
            >
              <CookieIcon icon={Check} roll={-8} size={48} />
              {t("card.create")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default CardComposer;
