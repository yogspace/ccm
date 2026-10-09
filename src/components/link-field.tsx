import { Check, Cloud, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { type OnlineResult, putOnline, shareLinkOf } from "../account/client";
import { launchCookie, launchSpot } from "../cookie-flight";
import { shapeOf } from "../short-shape";
import { saveCookie, store } from "../store";
import { openAccount } from "./account-dialog";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInButton, shareLink, shareUrl } from "./styles";

/** The link to share – short if its creation is online (account/client.ts). */
export const useShareLink = (url: string) => {
  const { jar } = useSnapshot(store);
  return url ? shareLinkOf(jar, url) : url;
};

type Props = {
  link: string;
  disabled?: boolean;
  onCopy?: () => void;
};

/**
 * The link itself is the button: a click copies it. Long – its creation only
 * here – it offers to put the creation online: saved as a cookie, into the
 * account, and the link is short.
 */
const LinkField = ({ link, disabled, onCopy }: Props) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<OnlineResult | null>(null);
  const long = shapeOf(link) !== null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    onCopy?.();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt(t("share.copy"), link);
    }
  };

  const goOnline = async (button: HTMLElement) => {
    const hash = saveCookie();
    if (!hash) return;
    launchCookie(launchSpot(button), hash);
    setBusy(true);
    setFailed(null);
    const result = await putOnline(hash);
    setBusy(false);
    if (result === "login") openAccount();
    else if (result !== "ok") setFailed(result);
  };

  return (
    <>
      <Button
        aria-label={copied ? t("share.copied") : t("share.copy")}
        className={shareLink}
        data-copied={copied || undefined}
        disabled={disabled}
        onClick={copy}
        title={t("share.copy")}
        type="button"
      >
        <span aria-live="polite" className={shareUrl}>
          {copied ? t("share.copied") : link}
        </span>
        {copied ? (
          <CookieIcon
            className={cookieInButton}
            icing="#00b86b"
            icon={Check}
            key="ok"
            size={44}
          />
        ) : (
          <CookieIcon
            className={cookieInButton}
            icing="#2a44ff"
            icon={Copy}
            key="copy"
            size={44}
          />
        )}
      </Button>
      {long && (
        <Button
          className="-mt-1 gap-1.5 self-start pl-3 text-small font-bold"
          disabled={disabled || busy}
          kind="link"
          onClick={(event) => goOnline(event.currentTarget)}
          title={t("share.onlineHint")}
          type="button"
        >
          <CookieIcon
            className={cookieInButton}
            icing="#2a44ff"
            icon={Cloud}
            roll={-8}
            size={36}
            spin={busy}
          />
          {t("share.online")}
        </Button>
      )}
      {failed && (
        <p className="-mt-2 text-small text-muted">
          {t(failed === "full" ? "jar.full" : "account.failed")}
        </p>
      )}
    </>
  );
};

export default LinkField;
