import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const PrintHints = () => {
  const { t } = useTranslation();

  return (
    <details className="hints">
      <summary>
        <Info aria-hidden size={16} />
        {t("hints.title")}
      </summary>
      <ul>
        <li>{t("hints.material")}</li>
        <li>{t("hints.orientation")}</li>
        <li>{t("hints.supports")}</li>
        <li>{t("hints.slicer")}</li>
        <li>{t("hints.bambu")}</li>
      </ul>
    </details>
  );
};

export default PrintHints;
