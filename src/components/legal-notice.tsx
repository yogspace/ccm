import { X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "../assets";
import { dialogClosed, dialogOpened } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * “Imprint & privacy”: a link in the footer that opens the legal text as a
 * dialog. The text comes from the CMS (“Imprint & privacy” global), rendered
 * on the server (legal/legal-content.tsx) and handed over with the page.
 */
const LegalNotice = () => {
  const { t, i18n } = useTranslation();
  const { legal } = useAssets();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        className="link"
        onClick={() => {
          dialogRef.current?.showModal();
          dialogOpened();
        }}
        type="button"
      >
        {t("footer.imprint")}
      </Button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog natively, the click is only for the backdrop */}
      <dialog
        aria-label={t("footer.imprint")}
        className="legal"
        // A click on the dimmed backdrop closes the dialog.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        // Escape and the backdrop click end up here as well.
        onClose={dialogClosed}
        ref={dialogRef}
      >
        {/* Outside the scrolling area, so it stays put while scrolling. */}
        <Button
          aria-label={t("legal.close")}
          className="icon legal-close"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={56} />
        </Button>
        <div className="legal-body">
          {legal?.[i18n.resolvedLanguage === "de" ? "de" : "en"]}
        </div>
      </dialog>
    </>
  );
};

export default LegalNotice;
