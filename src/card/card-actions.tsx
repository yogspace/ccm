import { Download, ImageDown, RotateCw, Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../analytics";
import { cn } from "../cn";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import { cookieInButton } from "../components/styles";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import type { MeshData } from "../geometry/mesh";
import { hasShape, shared } from "./card-link";
import { useCardPicture } from "./use-card-picture";

/** The buttons below the card, on the page without a box. */
const action = "h-12 gap-2 rounded-xl pr-5 pl-3 text-body";
/** The main one: light; on phones across the whole row. */
const mainAction = cn(
  action,
  "bg-[#fffdf8] text-[#0d1033] hover:enabled:bg-white max-xs:col-span-full max-xs:h-10 max-xs:text-small"
);
/** The others: on phones side by side, each its cookie above its word. */
const sideAction = cn(
  action,
  "bg-white/14 text-on-page hover:enabled:bg-white/24 max-xs:h-auto max-xs:flex-col max-xs:gap-0 max-xs:px-1 max-xs:pt-1.5 max-xs:pb-1.5 max-xs:text-tiny"
);
const sideCookie = cn(cookieInButton, "max-xs:mx-0 max-xs:-mt-2 max-xs:-mb-2");

type Props = {
  mesh: MeshData | null;
  failed: boolean;
  onRetry: () => void;
  glaze: string;
  heading: string;
  name: string;
  sizeLabel: string;
};

/**
 * Below the card, without a box – it is about the card: the files to print
 * it and the picture of it in a row (or “Try again” if the cutter could not
 * be shaped). Phones: the 3MF across; STL, share and save side by side below
 * it, each its cookie above its word.
 */
const CardActions = ({
  mesh,
  failed,
  onRetry,
  glaze,
  heading,
  name,
  sizeLabel,
}: Props) => {
  const { t } = useTranslation();
  const picture = useCardPicture({ mesh, glaze, heading, name, sizeLabel });
  const [copied, setCopied] = useState(false);

  if (failed && !hasShape) return null;

  const save = (format: "3mf" | "stl") => {
    if (!mesh) return;
    const file = `${fileBase(name, shared.params.size)}.${format}`;
    download(format === "3mf" ? toThreeMf(mesh, name) : toStl(mesh), file);
    trackEvent(format === "3mf" ? "card-download-3mf" : "card-download-stl");
  };

  // The picture with the card's link, the link on its own line. Some apps
  // take only the picture and drop the text – so it goes on the clipboard as
  // well (both right in the click, before the permission for it expires).
  // Where files can't be shared, just the link; without a share menu at all,
  // the link is copied.
  const sharePicture = () => {
    const url = window.location.href;
    const text = `${heading}\n${url}`;
    trackEvent("card-picture");
    const failed = (error: unknown) => {
      // Cancelling the share menu is not an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    };
    if (picture && navigator.canShare?.({ files: [picture], text })) {
      navigator.clipboard?.writeText(text).catch(() => undefined);
      navigator.share({ files: [picture], title: heading, text }).catch(failed);
    } else if (typeof navigator.share === "function") {
      navigator.share({ title: heading, url }).catch(failed);
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => window.prompt(t("share.copy"), url));
    }
  };

  const savePicture = () => {
    if (!picture) return;
    trackEvent("card-picture");
    download(picture, picture.name);
  };

  return (
    <div
      className="row-start-5 mt-[clamp(0.2rem,1.2dvh,0.8rem)] flex animate-[greet-rise_0.9s_var(--ease-soft)_0.8s_both] flex-wrap justify-center gap-2.5 max-xs:grid max-xs:w-full max-xs:grid-cols-3 max-xs:gap-1.5 max-xs:[--cookie-scale:0.62]"
      data-part="actions"
    >
      {failed ? (
        <Button className={mainAction} onClick={onRetry} type="button">
          <CookieIcon
            className={cookieInButton}
            icing="#2a44ff"
            icon={RotateCw}
            idle={false}
            roll={-10}
            size={58}
          />
          {t("card.retry")}
        </Button>
      ) : (
        <>
          <Button
            className={mainAction}
            disabled={!mesh}
            onClick={() => save("3mf")}
            title={t("card.printHint")}
            type="button"
          >
            <CookieIcon
              className={cookieInButton}
              icing="#2a44ff"
              icon={Download}
              idle={false}
              roll={12}
              size={58}
            />
            {t("card.download")}
          </Button>
          <Button
            className={sideAction}
            disabled={!mesh}
            onClick={() => save("stl")}
            title={t("card.printHint")}
            type="button"
          >
            <CookieIcon
              className={sideCookie}
              icon={Download}
              idle={false}
              roll={-14}
              size={58}
            />
            {t("card.stl")}
          </Button>
          <Button
            className={sideAction}
            disabled={!picture}
            onClick={sharePicture}
            title={t("card.pictureHint")}
            type="button"
          >
            <CookieIcon
              className={sideCookie}
              icing="#ff5fa8"
              icon={Share2}
              idle={false}
              roll={10}
              size={58}
            />
            {copied ? t("share.copied") : t("card.pictureShare")}
          </Button>
          <Button
            className={sideAction}
            disabled={!picture}
            onClick={savePicture}
            title={t("card.pictureHint")}
            type="button"
          >
            <CookieIcon
              className={sideCookie}
              icing="#ffc31f"
              icon={ImageDown}
              idle={false}
              roll={-8}
              size={58}
            />
            {t("card.pictureSave")}
          </Button>
        </>
      )}
    </div>
  );
};

export default CardActions;
