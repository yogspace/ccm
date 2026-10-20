import { Download, Megaphone } from "lucide-react";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { launchCookie, launchSpot } from "../cookie-flight";
import { cookieSeed } from "../cookie-jar";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import {
  MAKERWORLD_GREETING,
  makerWorldZip,
  nearestColor,
} from "../export/makerworld";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { useCardColors } from "../site-context";
import { creationUrl, greetingLink, saveCookie, store } from "../store";
import { hasEmboss } from "../url-state";
import { useAdmin } from "../use-admin";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";
import { cookieInButton } from "./styles";

type Props = {
  /** The 3D view – its filament color is the MakerWorld pictures' color. */
  preview: RefObject<PreviewHandle | null>;
};

/**
 * Keeping the creation as a cookie, and downloads as STL and 3MF. Every
 * download keeps it as a cookie, too. Logged in to the CMS, a third download:
 * all it takes to put the cutter on MakerWorld (export/makerworld.ts).
 */
const ExportButtons = ({ preview }: Props) => {
  const { t } = useTranslation();
  const { cutter, name, params } = useSnapshot(store);
  const { mesh, outline, icing, imprint, inlay } = cutter;
  const { size } = params;
  const fileName = fileBase(name, size);
  const title = name.trim() || "Cookie Cutter";
  const [saved, setSaved] = useState(false);
  const admin = useAdmin();
  const cardColors = useCardColors();
  // The button shows the cookie this creation bakes.
  const shape = useMemo(
    () =>
      outline.length > 0
        ? { dough: outline, icing, imprint, inlay, seed: cookieSeed(outline) }
        : null,
    [outline, icing, imprint, inlay]
  );

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  /** Keeps the cookie and sends it flying from the button into the bar. */
  const keep = (button: HTMLElement) => {
    const hash = saveCookie();
    if (hash) launchCookie(launchSpot(button), hash);
  };

  const save = (button: HTMLElement, file: Blob, extension: "3mf" | "stl") => {
    download(file, `${fileName}.${extension}`);
    trackEvent(`download-${extension}`);
    if (hasEmboss(store.drawing)) trackEvent("download-embossed");
    keep(button);
  };

  /**
   * In the color the cutter has on screen; the card's link can only name
   * one of the CMS's card colors – the closest. Not counted in the
   * statistics: it is the admin's own.
   */
  const saveForMakerWorld = async (button: HTMLElement) => {
    if (!mesh) return;
    const color =
      preview.current?.filament() ?? cardColors[0]?.color ?? "#2a44ff";
    const cardColor = nearestColor(
      cardColors.map((entry) => entry.color),
      color
    );
    const zip = await makerWorldZip({
      mesh,
      name: title,
      fileName,
      color,
      cookie: shape,
      sizeLabel: `${Math.round(size)} mm`,
      editorUrl: creationUrl(),
      cardUrl: greetingLink({ ...MAKERWORLD_GREETING, color: cardColor }, "en"),
    });
    download(zip, `${fileName}-makerworld.zip`);
    keep(button);
  };

  return (
    <>
      {/* Right-aligned, wrapping instead of sticking out of the card */}
      <div className="flex flex-wrap items-center justify-end gap-4 self-stretch">
        {admin && (
          <Button
            disabled={!mesh}
            onClick={(event) => saveForMakerWorld(event.currentTarget)}
            title={t("export.makerWorldHint")}
            type="button"
          >
            <CookieIcon
              className={cookieInButton}
              icing="#ff6a1f"
              icon={Megaphone}
              roll={-8}
              size={58}
            />
            {t("export.makerWorld")}
          </Button>
        )}
        <Button
          disabled={!mesh}
          onClick={(event) => {
            keep(event.currentTarget);
            setSaved(true);
            trackEvent("cookie-saved");
          }}
          title={t("jar.saveHint")}
          type="button"
        >
          {shape ? (
            <CookieIcon
              className={cookieInButton}
              roll={-10}
              shape={shape}
              size={58}
            />
          ) : (
            <CookieIcon
              className={cookieInButton}
              kind="chip"
              roll={-10}
              size={58}
            />
          )}
          {saved ? t("jar.saved") : t("jar.save")}
        </Button>
        <Button
          disabled={!mesh}
          onClick={(event) =>
            mesh && save(event.currentTarget, toStl(mesh), "stl")
          }
          type="button"
        >
          <CookieIcon
            className={cookieInButton}
            icing="#2a44ff"
            icon={Download}
            roll={-14}
            size={58}
          />
          {t("export.stl")}
        </Button>
        <Button
          disabled={!mesh}
          kind="primary"
          onClick={async (event) => {
            // The event's target is gone once the file has been built.
            const button = event.currentTarget;
            if (mesh) save(button, await toThreeMf(mesh, title), "3mf");
          }}
          type="button"
        >
          <CookieIcon
            className={cookieInButton}
            icon={Download}
            roll={12}
            size={58}
          />
          {t("export.threeMf")}
        </Button>
      </div>
      {/* Said before printing, not found after: the maker's mark. */}
      <p className="-mt-2 self-end text-right text-small text-muted">
        {t("export.signature")}
      </p>
    </>
  );
};

export default ExportButtons;
