import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { store, trackCreation } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** Downloads as STL and 3MF. Every download counts the creation. */
const ExportButtons = () => {
  const { t } = useTranslation();
  const { cutter, name, params } = useSnapshot(store);
  const { mesh } = cutter;
  const { size } = params;
  const fileName = fileBase(name, size);
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
