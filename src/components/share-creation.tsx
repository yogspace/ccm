import { Check, Copy, Download, Share2, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { download } from "../export/download";
import {
  creationUrl,
  dialogClosed,
  dialogOpened,
  store,
  trackCreation,
} from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";

type Props = {
  /** Die 3D-Ansicht – sie rendert das Bild von oben. */
  preview: RefObject<PreviewHandle | null>;
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
 * aussieht, darunter den Link (Klick kopiert ihn) – dazu Bild speichern und,
 * wo der Browser es kann, Bild samt Text und Link teilen.
 */
const ShareCreation = ({ preview }: Props) => {
  const { t } = useTranslation();
  const { cutter, name } = useSnapshot(store);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState(false);
  /** Nach „Bild teilen“: Hinweis, dass Text und Link auch kopiert sind. */
  const [textCopied, setTextCopied] = useState(false);
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
    dialogRef.current?.showModal();
    dialogOpened();
    // Teilen zählt die Kreation.
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
    const text = `${t("share.text")} ${shared.url}`;
    // Manche Apps (z. B. Signal) übernehmen nur das Bild und lassen den Text
    // fallen – deshalb liegt er samt Link auch in der Zwischenablage. Beides
    // direkt im Klick aufrufen, sonst verfällt die Erlaubnis dafür.
    navigator.clipboard
      ?.writeText(text)
      .then(() => setTextCopied(true))
      .catch(() => undefined);
    navigator
      .share({ files: [shared.file], title, text })
      .catch((error: unknown) => {
        // Abbrechen im Teilen-Menü ist kein Fehler.
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
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape schließt den Dialog nativ, der Klick ist nur für den Hintergrund */}
      <dialog
        aria-label={t("share.creation")}
        className="legal share-sheet"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onClose={dialogClosed}
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
          {/* Der Link selbst ist der Knopf: Klick kopiert ihn. */}
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
              <CookieIcon icing="#2a44ff" icon={Copy} key="copy" size={44} />
            )}
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
                <CookieIcon icing="#ff5fa8" icon={Share2} roll={10} size={48} />
                {t("share.shareImage")}
              </Button>
            )}
          </div>
          {textCopied && <p className="share-note">{t("share.textCopied")}</p>}
        </div>
      </dialog>
    </>
  );
};

export default ShareCreation;
