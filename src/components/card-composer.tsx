import { ArrowUpRight, Check, Copy, Share2 } from "lucide-react";
import { type CSSProperties, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { cn } from "../cn";
import { GREETING_LIMITS, type Greeting } from "../greeting";
import { useCardColor } from "../site-context";
import { creationUrl, greetingLink, store } from "../store";
import { formatLength } from "../units";
import Button from "./button";
import CanvasView from "./canvas-view";
import ColorSwatches from "./color-swatches";
import CookieIcon from "./cookie-icon";
import Field from "./field";
import RingText from "./ring-text";
import {
  cookieInButton,
  fieldInput,
  ghost,
  ringOnGlaze,
  shareContent,
  shareIntro,
  shareLink,
  shareMore,
  shareUrl,
  shareVisual,
} from "./styles";

type Props = {
  greeting: Greeting;
  onChange: (greeting: Greeting) => void;
  /**
   * The cutter from above in the favorite color (share-creation.tsx
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
  // The favorite color from the CMS; an unknown number is the first.
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
      {/* The card page in small, in the favorite color: the message runs
          around the cutter. Its place is kept while the cutter renders. On
          the little card a long name is cut, it does not widen the card. */}
      <div
        aria-hidden
        className={cn(
          shareVisual,
          "glaze relative overflow-hidden rounded-3xl bg-glaze @container"
        )}
        style={{ "--glaze": glaze } as CSSProperties}
      >
        <RingText
          className={cn(
            ringOnGlaze,
            "animate-[ring-turn_150s_linear_infinite]"
          )}
          text={greeting.message.trim() || t("card.ring")}
        />
        <div className="absolute inset-[22.5%] grid -rotate-3 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] rounded-[5cqw] bg-card-sheet px-[3.5cqw] pt-[3cqw] pb-[3.5cqw] shadow-[0_1.2rem_2rem_-0.8rem_rgb(4_8_60/0.55)]">
          {picture ? (
            <CanvasView canvas={picture} className="min-h-0" />
          ) : (
            <span
              className={cn(
                "mb-[2cqw] block min-h-0 rounded-[3cqw] bg-[#f2e8d5]",
                cutter.mesh && ghost
              )}
            />
          )}
          <div className="flex items-baseline justify-between gap-[0.4em] text-[4.4cqw] leading-[1.2] font-bold text-card-ink">
            <span className="min-w-0 truncate">{title}</span>
            <small className="flex-none text-[0.7em] font-semibold text-card-ink-muted">
              {formatLength(params.size, unit, lang, unit === "in" ? 1 : 0)}
            </small>
          </div>
        </div>
      </div>

      <div className={shareContent}>
        <p className={shareIntro}>{t("card.intro")}</p>
        <div className="grid grid-cols-[1fr_1fr] gap-3 max-xs:grid-cols-[1fr]">
          <Field htmlFor={`${ids}-to`} label={t("card.to")}>
            <input
              autoComplete="off"
              className={cn(fieldInput, "h-11")}
              id={`${ids}-to`}
              maxLength={GREETING_LIMITS.name}
              onChange={(event) => set("to")(event.target.value)}
              placeholder={t("card.toPlaceholder")}
              value={greeting.to}
            />
          </Field>
          <Field htmlFor={`${ids}-from`} label={t("card.from")}>
            <input
              autoComplete="name"
              className={cn(fieldInput, "h-11")}
              id={`${ids}-from`}
              maxLength={GREETING_LIMITS.name}
              onChange={(event) => set("from")(event.target.value)}
              placeholder={t("card.fromPlaceholder")}
              value={greeting.from}
            />
          </Field>
        </div>
        <Field
          htmlFor={`${ids}-message`}
          label={
            <>
              {t("card.message")}
              <small className="font-medium text-muted">
                {greeting.message.length} / {GREETING_LIMITS.message}
              </small>
            </>
          }
        >
          <textarea
            className={cn(
              fieldInput,
              "field-sizing-content min-h-20 resize-none leading-[1.4]"
            )}
            id={`${ids}-message`}
            maxLength={GREETING_LIMITS.message}
            onChange={(event) => set("message")(event.target.value)}
            placeholder={t("card.ring")}
            rows={3}
            value={greeting.message}
          />
        </Field>
        {/* The favorite color: the page, the card, its words, the cutter
            and the cookie's icing in its shades. */}
        <ColorSwatches onChange={pick} value={chosen} />

        {link ? (
          <>
            <p className="font-bold text-ink">{t("card.ready")}</p>
            <Button
              aria-label={copied ? t("share.copied") : t("share.copy")}
              className={shareLink}
              data-copied={copied || undefined}
              onClick={copy}
              title={t("share.copy")}
              type="button"
            >
              <span aria-live="polite" className={shareUrl}>
                {copied ? t("share.copied") : link}
              </span>
              {copied ? (
                <CookieIcon
                  className={cookieInButton}
                  icing="#00b86b"
                  icon={Check}
                  key="ok"
                  size={44}
                />
              ) : (
                <CookieIcon
                  className={cookieInButton}
                  icing="#2a44ff"
                  icon={Copy}
                  key="copy"
                  size={44}
                />
              )}
            </Button>
            <div className={shareMore}>
              <Button
                kind={canSend ? undefined : "primary"}
                onClick={() => window.open(link, "_blank", "noopener")}
                type="button"
              >
                <CookieIcon
                  className={cookieInButton}
                  icing="#2a44ff"
                  icon={ArrowUpRight}
                  roll={-8}
                  size={48}
                />
                {t("card.open")}
              </Button>
              {canSend && (
                <Button kind="primary" onClick={send} type="button">
                  <CookieIcon
                    className={cookieInButton}
                    icon={Share2}
                    roll={10}
                    size={48}
                  />
                  {t("card.send")}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className={shareMore}>
            <Button
              disabled={!cutter.mesh}
              kind="primary"
              onClick={() => {
                setCreated({ link: greetingLink(greeting, lang), creation });
                trackEvent("card-created");
              }}
              type="button"
            >
              <CookieIcon
                className={cookieInButton}
                icon={Check}
                roll={-8}
                size={48}
              />
              {t("card.create")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default CardComposer;
