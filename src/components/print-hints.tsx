import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * Printing tips: a link that opens them as a popover, anchored to the link
 * (CSS anchor positioning) and moving to where there is room.
 */
const PrintHints = () => {
  const { t } = useTranslation();

  return (
    <>
      <Button
        className="link hints-toggle"
        popoverTarget="print-hints"
        type="button"
      >
        <CookieIcon icing="#2a44ff" icon={Info} roll={-12} size={44} />
        {t("hints.title")}
      </Button>
      <div className="popup hints" id="print-hints" popover="auto">
        <ul>
          <li>{t("hints.material")}</li>
          <li>{t("hints.foodSafe")}</li>
          <li>{t("hints.orientation")}</li>
          <li>{t("hints.supports")}</li>
          <li>{t("hints.slicer")}</li>
          <li>{t("hints.bambu")}</li>
        </ul>
      </div>
    </>
  );
};

export default PrintHints;
