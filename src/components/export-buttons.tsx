import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { launchCookie, launchSpot } from "../cookie-flight";
import { cookieSeed } from "../cookie-jar";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { saveCookie, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * Keeping the creation as a cookie, and downloads as STL and 3MF. Every
 * download keeps it as a cookie, too.
 */
const ExportButtons = () => {
  const { t } = useTranslation();
  const { cutter, name, params } = useSnapshot(store);
  const { mesh, outline, icing } = cutter;
  const { size } = params;
  const fileName = fileBase(name, size);
  const title = name.trim() || "Cookie Cutter";
  const [saved, setSaved] = useState(false);
  // The button shows the cookie this creation bakes.
  const shape = useMemo(
    () =>
      outline.length > 0
        ? { dough: outline, icing, seed: cookieSeed(outline) }
        : null,
    [outline, icing]
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
    keep(button);
  };

  return (
    <div className="actions">
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
          <CookieIcon roll={-10} shape={shape} size={58} />
        ) : (
          <CookieIcon kind="chip" roll={-10} size={58} />
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
        <CookieIcon icing="#2a44ff" icon={Download} roll={-14} size={58} />
        {t("export.stl")}
      </Button>
      <Button
        className="primary"
        disabled={!mesh}
        onClick={(event) =>
          mesh && save(event.currentTarget, toThreeMf(mesh, title), "3mf")
        }
        type="button"
      >
        <CookieIcon icon={Download} roll={12} size={58} />
        {t("export.threeMf")}
      </Button>
    </div>
  );
};

export default ExportButtons;
