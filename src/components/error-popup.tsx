import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useError } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * Error message as a popover over the drawing area (anchored to it with CSS
 * anchor positioning): shows up while there is an error, can be dismissed.
 */
const ErrorPopup = () => {
  const { t } = useTranslation();
  const error = useError();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popup = ref.current;
    if (!popup?.showPopover) return;
    const open = popup.matches(":popover-open");
    if (error && !open) popup.showPopover();
    if (!error && open) popup.hidePopover();
  }, [error]);

  return (
    <div className="popup error" popover="manual" ref={ref} role="alert">
      <span>{error && t(`errors.${error}`)}</span>
      <Button
        aria-label={t("legal.close")}
        className="icon"
        onClick={() => ref.current?.hidePopover()}
        type="button"
      >
        <CookieIcon icon={X} roll={8} size={40} />
      </Button>
    </div>
  );
};

export default ErrorPopup;
