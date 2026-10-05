import { Download } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { download } from "../export/download";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import type { MeshData } from "../geometry/mesh";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/** `children` stehen vor den Downloads (z. B. „Kreation teilen“). */
type Props = PropsWithChildren<{
  mesh: MeshData | null;
  name: string;
  size: number;
}>;

/** „Herz für Oma“ → „herz-fuer-oma“ */
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

const ExportButtons = ({ mesh, name, size, children }: Props) => {
  const { t } = useTranslation();
  const fileName = `${slugify(name) || "cookie-cutter"}-${Math.round(size)}mm`;
  const title = name.trim() || "Cookie Cutter";

  return (
    <div className="actions">
      {children}
      <Button
        disabled={!mesh}
        onClick={() => mesh && download(toStl(mesh), `${fileName}.stl`)}
        type="button"
      >
        <CookieIcon icing="#2a44ff" icon={Download} roll={-14} size={58} />
        {t("export.stl")}
      </Button>
      <Button
        className="primary"
        disabled={!mesh}
        onClick={() =>
          mesh && download(toThreeMf(mesh, title), `${fileName}.3mf`)
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
