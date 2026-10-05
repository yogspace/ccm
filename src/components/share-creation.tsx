import { Check, Download, Link, Share2, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { download } from "../export/download";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";

type Props = {
  /** Link mit der Zeichnung, erst beim Teilen berechnet. */
  getUrl: () => string;
  name: string;
  preview: RefObject<PreviewHandle | null>;
  disabled: boolean;
  /** Beim Öffnen – zählt die Kreation. */
  onShare?: () => void;
};

const SIZE = 1200;
const MARGIN = 60;
const CARD = { x: MARGIN, y: MARGIN, w: SIZE - 2 * MARGIN, h: 880 };

/**
 * Teilen-Bild im Look der App: blauer Grund, weiße Karte mit dem Ausstecher
 * von oben, darunter Name und Adresse.
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
 * „Kreation teilen“: öffnet ein Fenster mit dem Bild, wie der Ausstecher gerade
 * aussieht, darunter den Link zum Kopieren – dazu Bild speichern und, wo der
 * Browser es kann, mit Bild teilen.
 */
const ShareCreation = ({ getUrl, name, preview, disabled, onShare }: Props) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState(false);
  const title = name.trim() || "Cookie Cutter Maker";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Bild-URL wieder freigeben, wenn ein neues kommt oder das Fenster weg ist.
  useEffect(() => {
    const image = shared?.image;
    return () => {
      if (image) URL.revokeObjectURL(image);
    };
  }, [shared]);

  const open = async () => {
    const url = getUrl();
    const handle = preview.current;
    const blob = handle ? await composeImage(handle, name) : null;
    const file =
      blob &&
      new File([blob], `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`, {
        type: "image/png",
      });
    setShared({ url, file, image: blob ? URL.createObjectURL(blob) : null });
    setCopied(false);
    dialogRef.current?.showModal();
    onShare?.();
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

  const shareWithImage = async () => {
    if (!shared?.file) return;
    try {
      await navigator.share({
        files: [shared.file],
        title,
        text: `${t("share.text")} ${shared.url}`,
      });
    } catch (error) {
      // Abbrechen im Teilen-Menü ist kein Fehler.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    }
  };

  const canShareImage =
    !!shared?.file && !!navigator.canShare?.({ files: [shared.file] });

  return (
    <>
      <Button
        disabled={disabled}
        onClick={open}
        title={t("share.creationHint")}
        type="button"
      >
        <CookieIcon icing="#ff5fa8" icon={Share2} roll={10} size={52} />
        {t("share.creation")}
      </Button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape schließt den Dialog nativ, der Klick ist nur für den Hintergrund */}
      <dialog
        aria-label={t("share.creation")}
        className="legal share-sheet"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
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
        <div className="legal-body">
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
          <div className="share-link">
            <input
              aria-label={t("share.link")}
              onFocus={(event) => event.target.select()}
              readOnly
              type="text"
              value={shared?.url ?? ""}
            />
            <Button
              className="copy"
              data-copied={copied || undefined}
              onClick={copy}
              type="button"
            >
              {copied ? (
                <CookieIcon icing="#00b86b" icon={Check} key="ok" size={48} />
              ) : (
                <CookieIcon icon={Link} key="link" roll={-22} size={48} />
              )}
              <span aria-live="polite">
                {copied ? t("share.copied") : t("share.copy")}
              </span>
            </Button>
          </div>
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
              <Button onClick={shareWithImage} type="button">
                <CookieIcon icing="#ff5fa8" icon={Share2} roll={10} size={48} />
                {t("share.shareImage")}
              </Button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
};

export default ShareCreation;
