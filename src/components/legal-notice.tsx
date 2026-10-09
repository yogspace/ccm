import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "../assets";
import Button from "./button";
import Dialog, { openDialog } from "./dialog";

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
        className="text-on-page-muted hover:enabled:text-on-page"
        kind="link"
        onClick={() => openDialog(dialogRef)}
        type="button"
      >
        {t("footer.imprint")}
      </Button>
      {/* The text from the CMS has no classes of its own – its headings,
          paragraphs, lists and links are styled from here. */}
      <Dialog
        bodyClassName="[&_:is(p,address)]:mb-2 [&_:is(p,address)]:text-muted [&_:is(ul,ol)]:my-4 [&_:is(ul,ol)]:pl-10 [&_a]:text-ink [&_a]:hover:underline [&_a]:hover:underline-offset-3 [&_address]:not-italic [&_h2]:pr-12 [&_h2]:text-title [&_h2]:leading-[1.2] [&_h2]:font-bold [&_h2]:tracking-title [&_h2]:embolden-20 [&_h2:not(:first-of-type)]:mt-9 [&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-body [&_h3]:font-bold [&_ol]:list-decimal [&_ul]:list-disc"
        label={t("footer.imprint")}
        ref={dialogRef}
      >
        {legal?.[i18n.resolvedLanguage === "de" ? "de" : "en"]}
      </Dialog>
    </>
  );
};

export default LegalNotice;
