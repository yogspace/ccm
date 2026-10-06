import { Check, Copy, Download, Gift, Share2, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { download } from "../export/download";
import type { Greeting } from "../greeting";
import {
  creationUrl,
  dialogClosed,
  dialogOpened,
  store,
  trackCreation,
} from "../store";
import Button from "./button";
import CardComposer from "./card-composer";
import CookieIcon from "./cookie-icon";
import DonateBadge from "./donate-badge";
import type { PreviewHandle } from "./preview-3d";

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

type Shared = { url: string; file: File | null; image: string | null };

/**
 * “Share creation”: opens a window with the picture of how the cutter looks
 * right now, below it the link (a click copies it) – plus saving the picture
 * and, where the browser can, sharing it together with text and link.
 */
const ShareCreation = ({ preview }: Props) => {
  const { t } = useTranslation();
  const { cutter, name } = useSnapshot(store);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState(false);
  /** Open: the sun only mounts then, so it grows in after the dialog. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** After “Share image”: a note that text and link were copied too. */
  const [textCopied, setTextCopied] = useState(false);
  /** Sharing as usual, or writing a greeting card. */
  const [mode, setMode] = useState<"share" | "card">("share");
  const [greeting, setGreeting] = useState<Greeting>({
    to: "",
    from: "",
    message: "",
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const switchTo = (next: "share" | "card") => {
    setMode(next);
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const title = name.trim() || "Cookie Cutter Maker";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Release the image URL when a new one comes or the window is gone.
  useEffect(() => {
    const image = shared?.image;
    return () => {
      if (image) URL.revokeObjectURL(image);
    };
  }, [shared]);

  const open = async () => {
    const url = creationUrl();
    const handle = preview.current;
    const blob = handle ? await composeImage(handle, name) : null;
    const file =
      blob &&
      new File([blob], `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`, {
        type: "image/png",
      });
    setShared({ url, file, image: blob ? URL.createObjectURL(blob) : null });
    setCopied(false);
    setTextCopied(false);
    setSheetOpen(true);
    dialogRef.current?.showModal();
    dialogOpened();
    // Sharing counts the creation.
    trackCreation();
  };

  const copy = async () => {
    if (!shared) return;
    try {
      await navigator.clipboard.writeText(shared.url);
      setCopied(true);
    } catch {
      window.prompt(t("share.copy"), shared.url);
    }
  };

  const shareImage = () => {
    if (!shared?.file) return;
    // The link on its own line, so it does not stick to the text.
    const text = `${t("share.text")}\n${shared.url}`;
    // Some apps (e.g. Signal) take only the image and drop the text – so it is
    // on the clipboard as well, link included. Call both right in the click,
    // otherwise the permission for it expires.
    navigator.clipboard
      ?.writeText(text)
      .then(() => setTextCopied(true))
      .catch(() => undefined);
    navigator
      .share({ files: [shared.file], title, text })
      .catch((error: unknown) => {
        // Cancelling the share menu is not an error.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
        }
      });
  };

  const canShareImage =
    !!shared?.file &&
    !!navigator.canShare?.({ files: [shared.file], text: shared.url });

  return (
    <>
      <Button
        disabled={!cutter.mesh}
        onClick={open}
        title={t("share.creationHint")}
        type="button"
      >
        <CookieIcon icing="#ff5fa8" icon={Share2} roll={10} size={52} />
        {t("share.creation")}
      </Button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog natively, the click is only for the backdrop */}
      <dialog
        aria-label={t("share.creation")}
        className="legal share-sheet"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onClose={() => {
          setSheetOpen(false);
          setMode("share");
          dialogClosed();
        }}
        ref={dialogRef}
      >
        <Button
          aria-label={t("legal.close")}
          className="icon legal-close"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={56} />
        </Button>
        <div className="legal-body" ref={bodyRef}>
          {mode === "card" ? (
            <CardComposer
              greeting={greeting}
              onBack={() => switchTo("share")}
              onChange={setGreeting}
              preview={preview}
            />
          ) : (
            <>
              <h2>{t("share.creation")}</h2>
              {shared?.image && (
                <img
                  alt={t("share.imageAlt", { name: title })}
                  className="share-image"
                  height={SIZE}
                  src={shared.image}
                  width={SIZE}
                />
              )}
              <p>{t("share.creationText")}</p>
              {/* The link itself is the button: a click copies it. */}
              <Button
                aria-label={copied ? t("share.copied") : t("share.copy")}
                className="share-link"
                data-copied={copied || undefined}
                onClick={copy}
                title={t("share.copy")}
                type="button"
              >
                <span aria-live="polite" className="share-url">
                  {copied ? t("share.copied") : shared?.url}
                </span>
                {copied ? (
                  <CookieIcon icing="#00b86b" icon={Check} key="ok" size={44} />
                ) : (
                  <CookieIcon
                    icing="#2a44ff"
                    icon={Copy}
                    key="copy"
                    size={44}
                  />
                )}
              </Button>
              {/* The greeting card: its own page with the message around the cutter. */}
              <Button
                className="card-offer"
                onClick={() => switchTo("card")}
                type="button"
              >
                <CookieIcon icing="#ffc31f" icon={Gift} roll={-10} size={56} />
                <span>
                  <strong>{t("card.share")}</strong>
                  <small>{t("card.shareHint")}</small>
                </span>
              </Button>
              <div className="share-more">
                <Button
                  disabled={!shared?.file}
                  onClick={() =>
                    shared?.file && download(shared.file, shared.file.name)
                  }
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
                  <Button onClick={shareImage} type="button">
                    <CookieIcon
                      icing="#ff5fa8"
                      icon={Share2}
                      roll={10}
                      size={48}
                    />
                    {t("share.shareImage")}
                  </Button>
                )}
              </div>
              {textCopied && (
                <p className="share-note">{t("share.textCopied")}</p>
              )}
            </>
          )}
        </div>
        {/* While they are happy with their cutter: a cookie for the maker. */}
        {sheetOpen && <DonateBadge delay={450} />}
      </dialog>
    </>
  );
};

export default ShareCreation;
