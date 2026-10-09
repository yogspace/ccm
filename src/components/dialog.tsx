import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import { dialogClosed, dialogOpened } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInIconButton } from "./styles";

/** Opens the dialog – the page does not scroll meanwhile (store.dialogs). */
export const openDialog = (dialog: RefObject<HTMLDialogElement | null>) => {
  if (!dialog.current || dialog.current.open) return;
  dialog.current.showModal();
  dialogOpened();
};

type Props = {
  ref: RefObject<HTMLDialogElement | null>;
  label: string;
  /** Classes for its scrolling text, e.g. for text without classes. */
  bodyClassName?: string;
  /** Closed – by its X, Escape or a click beside it. */
  onClose?: () => void;
  children: ReactNode;
};

/**
 * A dialog over the dimmed, blurred page (the imprint, the account): it
 * rises in; its X, Escape or a click beside it close it. Its padding keeps
 * the scrollbar away from the round corners – a slim, round one without a
 * track (in Safari too). Aligned on its own: it may sit in a centered
 * footer.
 */
const Dialog = ({ ref, label, bodyClassName, onClose, children }: Props) => {
  const { t } = useTranslation();
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog natively, the click is only for the backdrop
    <dialog
      aria-label={label}
      className="m-auto max-h-[min(85dvh,48rem)] w-[min(40rem,100%-2rem)] translate-y-4 scale-98 overflow-hidden rounded-3xl bg-surface p-2.5 text-left text-ink opacity-0 [transition:opacity_0.25s_var(--ease-soft),translate_0.35s_var(--ease-spring),scale_0.35s_var(--ease-spring),overlay_0.25s_allow-discrete,display_0.25s_allow-discrete] backdrop:bg-black/0 backdrop:backdrop-blur-[0px] backdrop:[transition:background_0.25s_var(--ease-soft),backdrop-filter_0.25s_var(--ease-soft),overlay_0.25s_allow-discrete,display_0.25s_allow-discrete] open:flex open:translate-y-0 open:scale-100 open:flex-col open:opacity-100 open:backdrop:bg-black/35 open:backdrop:backdrop-blur-xs starting:open:translate-y-4 starting:open:scale-98 starting:open:opacity-0 starting:open:backdrop:bg-black/0 starting:open:backdrop:backdrop-blur-[0px]"
      // A click on the dimmed backdrop closes the dialog.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      // Escape and the backdrop click end up here as well.
      onClose={() => {
        dialogClosed();
        onClose?.();
      }}
      ref={ref}
    >
      {/* Outside the scrolling area, so it stays put while scrolling. */}
      <Button
        aria-label={t("legal.close")}
        className="absolute top-4 right-4 z-1 size-10"
        kind="icon"
        onClick={() => ref.current?.close()}
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
      <div
        className={cn(
          "min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-6 text-body [scrollbar-color:color-mix(in_oklab,var(--color-muted)_55%,transparent)_transparent] scrollbar-thin [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted/55",
          bodyClassName
        )}
      >
        {children}
      </div>
    </dialog>
  );
};

export default Dialog;
