import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import CookieIcon from "./cookie-icon";

const PrintHints = () => {
  const { t } = useTranslation();

  return (
    <details className="hints">
      <summary>
        <CookieIcon icing="#2a44ff" icon={Info} roll={-12} size={44} />
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
