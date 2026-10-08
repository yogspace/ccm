import { ArrowRight, Check, Copy, Download, Gift, Share2 } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { download } from "../export/download";
import { filamentFor } from "../filaments";
import type { Greeting } from "../greeting";
import { drawingKey } from "../hash-text";
import { creationUrl, store } from "../store";
import Button from "./button";
import CardComposer from "./card-composer";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";
import RingText from "./ring-text";
import Segmented from "./segmented";
import { useGrow } from "./use-grow";
import { useLivePicture } from "./use-live-picture";

type Props = {
  /** The 3D view – it renders the picture from above. */
  preview: RefObject<PreviewHandle | null>;
};

const SIZE = 1200;
const MARGIN = 60;
const CARD = { x: MARGIN, y: MARGIN, w: SIZE - 2 * MARGIN, h: 880 };

/**
 * Share picture in the app's look: blue background, a white card with the
 * cutter from above, below it the name and address.
 */
const composeImage = async (preview: PreviewHandle, name: string) => {
  const render = preview.renderTop(CARD.w, CARD.h);
  if (!render) return null;
  await document.fonts.load('700 1em "Pally"').catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#2a44ff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, 48);
  ctx.fill();
  ctx.drawImage(render, CARD.x, CARD.y);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = '700 76px "Pally", system-ui, sans-serif';
  ctx.fillText(
    name.trim() || "Cookie Cutter",
    MARGIN,
    CARD.y + CARD.h + 120,
    CARD.w
  );
  ctx.fillStyle = "rgb(255 255 255 / 0.78)";
  ctx.font = '500 38px "Pally", system-ui, sans-serif';
  ctx.fillText("Cookie Cutter Maker · ccm.mxwr.de", MARGIN, SIZE - 70, CARD.w);

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
};

type Picture = { file: File; src: string };
type Mode = "picture" | "card";

/** The card's cutter colour – the same the card page picks (by the drawing). */
const cardFilament = () => filamentFor(drawingKey(new URL(creationUrl()).hash));

/**
 * “Share creation”: one box below the editor, only what is needed. As a
 * picture: the picture as it will be shared (it follows the drawing), the
 * link (a click copies it), sharing and saving the picture. As a greeting
 * card: the picture becomes the little card with the message around the
 * cutter, the fields appear beside it – and the box grows along. Only the
 * picture on show renders; the other waits until it is switched to.
 */
const ShareCreation = ({ preview }: Props) => {
  const { t } = useTranslation();
  const { cutter, name } = useSnapshot(store);
  const boxRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("picture");
  // Kept while switching back and forth.
  const [greeting, setGreeting] = useState<Greeting>({
    to: "",
    from: "",
    message: "",
  });
  const [copied, setCopied] = useState(false);
  /** After “Share image”: a note that text and link were copied too. */
  const [textCopied, setTextCopied] = useState(false);
  const title = name.trim() || "Cookie Cutter Maker";
  const url = creationUrl();
  useGrow(boxRef, bodyRef);

  const picture = useLivePicture<Picture>(
    boxRef,
    [cutter.mesh, name],
    async () => {
      const handle = preview.current;
      const blob = handle ? await composeImage(handle, name) : null;
      if (!blob) return null;
      const file = new File(
        [blob],
        `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`,
        { type: "image/png" }
      );
      return { file, src: URL.createObjectURL(blob) };
    },
    {
      enabled: mode === "picture",
      release: ({ src }) => URL.revokeObjectURL(src),
    }
  );
  const cardPicture = useLivePicture<string>(
    boxRef,
    [cutter.mesh],
    () =>
      preview.current
        ?.renderTop(640, 560, cardFilament())
        ?.toDataURL("image/png") ?? null,
    { enabled: mode === "card" }
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    trackEvent("share-link");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t("share.copy"), url);
    }
  };

  const shareImage = () => {
    if (!picture) return;
    trackEvent("share-image");
    // The link on its own line, so it does not stick to the text.
    const text = `${t("share.text")}\n${url}`;
    // Some apps (e.g. Signal) take only the image and drop the text – so it is
    // on the clipboard as well, link included. Call both right in the click,
    // otherwise the permission for it expires.
    navigator.clipboard
      ?.writeText(text)
      .then(() => setTextCopied(true))
      .catch(() => undefined);
    navigator
      .share({ files: [picture.file], title, text })
      .catch((error: unknown) => {
        // Cancelling the share menu is not an error.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      });
  };

  const canShareImage =
    !!picture && !!navigator.canShare?.({ files: [picture.file], text: url });

  return (
    <section className="card share-box" ref={boxRef}>
      <div className="share-body" ref={bodyRef}>
        <div className="card-head">
          <h2>{t("share.creation")}</h2>
          <Segmented
            label={t("share.creation")}
            onChange={setMode}
            options={[
              { value: "picture", label: t("share.asPicture") },
              { value: "card", label: t("share.asCard") },
            ]}
            value={mode}
          />
        </div>
        <div className="share-layout">
          {mode === "card" ? (
            <CardComposer
              greeting={greeting}
              onChange={setGreeting}
              picture={cardPicture}
            />
          ) : (
            <>
              {/* Its place is kept while it renders – nothing jumps. */}
              <div
                className="share-visual share-picture"
                data-waiting={(!picture && !!cutter.mesh) || undefined}
              >
                {picture && (
                  <img
                    alt={t("share.imageAlt", { name: title })}
                    height={SIZE}
                    key={picture.src}
                    src={picture.src}
                    width={SIZE}
                  />
                )}
              </div>
              <div className="share-content">
                <p className="share-intro">{t("share.creationText")}</p>
                {/* The other way to share, right where it is seen – with the
                    card page in miniature, a taste of what it becomes. */}
                <Button
                  className="card-invite"
                  onClick={() => setMode("card")}
                  type="button"
                >
                  <span aria-hidden className="card-invite-preview">
                    <RingText text={t("card.ring")} />
                    <span className="card-invite-card">
                      <CookieIcon
                        className="card-invite-gift"
                        icing="#ffc31f"
                        icon={Gift}
                        idle={false}
                        roll={-10}
                        size={44}
                      />
                    </span>
                  </span>
                  <span className="card-invite-text">
                    <strong>{t("share.cardInvite")}</strong>
                    <small>{t("share.cardInviteHint")}</small>
                  </span>
                  <CookieIcon
                    className="card-invite-arrow"
                    icing="#ff5fa8"
                    icon={ArrowRight}
                    idle={false}
                    size={40}
                  />
                </Button>
                {/* The link itself is the button: a click copies it. */}
                <Button
                  aria-label={copied ? t("share.copied") : t("share.copy")}
                  className="share-link"
                  data-copied={copied || undefined}
                  disabled={!cutter.mesh}
                  onClick={copy}
                  title={t("share.copy")}
                  type="button"
                >
                  <span aria-live="polite" className="share-url">
                    {copied ? t("share.copied") : url}
                  </span>
                  {copied ? (
                    <CookieIcon
                      icing="#00b86b"
                      icon={Check}
                      key="ok"
                      size={44}
                    />
                  ) : (
                    <CookieIcon
                      icing="#2a44ff"
                      icon={Copy}
                      key="copy"
                      size={44}
                    />
                  )}
                </Button>
                <div className="share-more">
                  <Button
                    className={canShareImage ? undefined : "primary"}
                    disabled={!picture}
                    onClick={() => {
                      if (!picture) return;
                      download(picture.file, picture.file.name);
                      trackEvent("save-image");
                    }}
                    type="button"
                  >
                    <CookieIcon
                      icing="#2a44ff"
                      icon={Download}
                      roll={-12}
                      size={48}
                    />
                    {t("share.saveImage")}
                  </Button>
                  {canShareImage && (
                    <Button
                      className="primary"
                      onClick={shareImage}
                      type="button"
                    >
                      <CookieIcon
                        icing="#ff5fa8"
                        icon={Share2}
                        roll={10}
                        size={48}
                      />
                      {t("share.share")}
                    </Button>
                  )}
                </div>
                {textCopied && (
                  <p className="share-note">{t("share.textCopied")}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ShareCreation;
