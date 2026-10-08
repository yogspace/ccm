import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInButton, popup } from "./styles";

/**
 * Printing tips: a link that opens them as a popover, anchored to the link
 * (CSS anchor positioning) and moving to where there is room.
 */
const PrintHints = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* A quiet link at the end of the export row */}
      <Button
        className="gap-1.5 self-end [anchor-name:--print-hints]"
        kind="link"
        popoverTarget="print-hints"
        type="button"
      >
        <CookieIcon
          className={cookieInButton}
          icing="#2a44ff"
          icon={Info}
          roll={-12}
          size={44}
        />
        {t("hints.title")}
      </Button>
      <div
        className={cn(
          popup,
          "[position-anchor:--print-hints] [position-area:block-start_span-inline-start]"
        )}
        id="print-hints"
        popover="auto"
      >
        <ul className="list-disc space-y-1.5 pl-5">
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
