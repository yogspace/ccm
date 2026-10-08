import { X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "../assets";
import { dialogClosed, dialogOpened } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInIconButton } from "./styles";

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
        onClick={() => {
          dialogRef.current?.showModal();
          dialogOpened();
        }}
        type="button"
      >
        {t("footer.imprint")}
      </Button>
      {/* Rises in over a dimmed, blurred page. Its padding keeps the
          scrollbar away from the round corners. Aligned on its own – it
          sits in the footer, on the card's page in a centered one. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog natively, the click is only for the backdrop */}
      <dialog
        aria-label={t("footer.imprint")}
        className="m-auto max-h-[min(85dvh,48rem)] w-[min(40rem,100%-2rem)] text-left translate-y-4 scale-98 overflow-hidden rounded-3xl bg-surface p-2.5 text-ink opacity-0 [transition:opacity_0.25s_var(--ease-soft),translate_0.35s_var(--ease-spring),scale_0.35s_var(--ease-spring),overlay_0.25s_allow-discrete,display_0.25s_allow-discrete] backdrop:bg-black/0 backdrop:backdrop-blur-[0px] backdrop:[transition:background_0.25s_var(--ease-soft),backdrop-filter_0.25s_var(--ease-soft),overlay_0.25s_allow-discrete,display_0.25s_allow-discrete] open:flex open:translate-y-0 open:scale-100 open:flex-col open:opacity-100 open:backdrop:bg-black/35 open:backdrop:backdrop-blur-xs starting:open:translate-y-4 starting:open:scale-98 starting:open:opacity-0 starting:open:backdrop:bg-black/0 starting:open:backdrop:backdrop-blur-[0px]"
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
          className="absolute top-4 right-4 z-1 size-10"
          kind="icon"
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          <CookieIcon
            className={cookieInIconButton}
            icing="#ff5fa8"
            icon={X}
            roll={8}
            size={56}
          />
        </Button>
        {/* The text from the CMS has no classes of its own – its headings,
            paragraphs, lists and links are styled from here. A slim, round
            scrollbar without a track (in Safari too). */}
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-6 text-body [scrollbar-color:color-mix(in_oklab,var(--color-muted)_55%,transparent)_transparent] scrollbar-thin [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted/55 [&_:is(p,address)]:mb-2 [&_:is(p,address)]:text-muted [&_:is(ul,ol)]:my-4 [&_:is(ul,ol)]:pl-10 [&_a]:text-ink [&_a]:hover:underline [&_a]:hover:underline-offset-3 [&_address]:not-italic [&_h2]:pr-12 [&_h2]:text-title [&_h2]:leading-[1.2] [&_h2]:font-bold [&_h2]:tracking-title [&_h2]:embolden-20 [&_h2:not(:first-of-type)]:mt-9 [&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:text-body [&_h3]:font-bold [&_ol]:list-decimal [&_ul]:list-disc">
          {legal?.[i18n.resolvedLanguage === "de" ? "de" : "en"]}
        </div>
      </dialog>
    </>
  );
};

export default LegalNotice;
