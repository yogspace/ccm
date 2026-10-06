import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { download } from "../export/download";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { store, trackCreation } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** “Herz für Oma” → “herz-fuer-oma” */
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Downloads as STL and 3MF. Every download counts the creation. */
const ExportButtons = () => {
  const { t } = useTranslation();
  const { cutter, name, params } = useSnapshot(store);
  const { mesh } = cutter;
  const { size } = params;
  const fileName = `${slugify(name) || "cookie-cutter"}-${Math.round(size)}mm`;
  const title = name.trim() || "Cookie Cutter";

  return (
    <div className="actions">
      <Button
        disabled={!mesh}
        onClick={() => {
          if (!mesh) return;
          download(toStl(mesh), `${fileName}.stl`);
          trackCreation();
        }}
        type="button"
      >
        <CookieIcon icing="#2a44ff" icon={Download} roll={-14} size={58} />
        {t("export.stl")}
      </Button>
      <Button
        className="primary"
        disabled={!mesh}
        onClick={() => {
          if (!mesh) return;
          download(toThreeMf(mesh, title), `${fileName}.3mf`);
          trackCreation();
        }}
        type="button"
      >
        <CookieIcon icon={Download} roll={12} size={58} />
        {t("export.threeMf")}
      </Button>
    </div>
  );
};

export default ExportButtons;
