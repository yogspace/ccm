import {
  Check,
  Copy,
  KeyRound,
  LogIn,
  LogOut,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createRef, type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import {
  account,
  createAccount,
  deleteAccount,
  type LoginResult,
  logIn,
  logOut,
  type Proposal,
  proposeAccount,
} from "../account/client";
import { trackEvent } from "../analytics";
import { cn } from "../cn";
import { store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import Dialog, { openDialog } from "./dialog";
import { cookieInButton, fieldInput } from "./styles";

const useLang = () => {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage === "de" ? "de" : "en";
};

/**
 * Not logged in: a new account, or logging in with the passphrase – needed
 * to put a cookie online, which is said when one waits for it.
 */
const Welcome = ({
  onProposed,
}: {
  onProposed: (proposal: Proposal) => void;
}) => {
  const { t } = useTranslation();
  const lang = useLang();
  // A cookie waiting to go online: said why an account is asked for.
  const { pending } = useSnapshot(account);
  const { jar } = useSnapshot(store);
  const waiting = pending && jar.find(({ hash }) => hash === pending);
  // Known in this browser (the login ran out): ready to log in again.
  const [typed, setTyped] = useState(() => account.passphrase ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginResult | null>(null);

  // Only a passphrase for now – the account follows once it is noted.
  const create = async () => {
    setBusy(true);
    setError(null);
    const { result, proposal } = await proposeAccount(lang);
    setBusy(false);
    if (proposal) onProposed(proposal);
    else setError(result);
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!typed.trim()) return;
    setBusy(true);
    setError(null);
    const result = await logIn(typed);
    setBusy(false);
    if (result === "ok") setTyped("");
    else setError(result);
  };

  return (
    <div className="mt-3 grid gap-6">
      {waiting && (
        <p className="font-bold">
          {t("account.needed", { name: waiting.name || t("jar.unnamed") })}
        </p>
      )}
      <p className="text-muted">{t("account.intro")}</p>
      <div className="grid justify-items-start gap-2">
        <Button disabled={busy} kind="primary" onClick={create} type="button">
          <CookieIcon
            className={cookieInButton}
            icing="#ffc31f"
            icon={Sparkles}
            roll={-10}
            size={48}
          />
          {t("account.create")}
        </Button>
        <small className="text-small text-muted">
          {t("account.createHint")}
        </small>
      </div>
      <form className="grid gap-2" onSubmit={login}>
        <h3 className="font-bold">{t("account.haveOne")}</h3>
        <div className="flex gap-2 max-xs:flex-col">
          <input
            aria-label={t("account.passphrase")}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={cn(fieldInput, "h-11 flex-1")}
            // Typed as it is shown: a space (or comma) becomes a hyphen.
            onChange={(event) =>
              setTyped(
                event.target.value
                  .replace(/[\s,]+/g, "-")
                  .replace(/-{2,}/g, "-")
              )
            }
            placeholder={t("account.placeholder")}
            spellCheck={false}
            value={typed}
          />
          <Button
            className="h-11"
            disabled={busy || !typed.trim()}
            type="submit"
          >
            <CookieIcon
              className={cookieInButton}
              icing="#2a44ff"
              icon={LogIn}
              roll={8}
              size={48}
            />
            {t("account.logIn")}
          </Button>
        </div>
        {error && error !== "ok" && (
          <p aria-live="polite" className="text-small font-bold">
            {t(`account.${error}`)}
          </p>
        )}
      </form>
      <p className="text-small text-muted">{t("account.idle")}</p>
    </div>
  );
};

/**
 * A passphrase proposed, shown once – to be written down. Noted, the
 * account is made; cancelled, nothing is.
 */
const Fresh = ({
  proposal,
  onDone,
  onRenew,
}: {
  proposal: Proposal;
  onDone: () => void;
  onRenew: (proposal: Proposal) => void;
}) => {
  const { t } = useTranslation();
  const lang = useLang();
  const { passphrase } = proposal;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<
    "renewed" | Exclude<LoginResult, "ok"> | null
  >(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(passphrase);
      setCopied(true);
    } catch {
      window.prompt(t("account.yourPassphrase"), passphrase);
    }
  };
  const cancel = () => {
    // A cookie waiting to go online stays offline.
    account.pending = null;
    onDone();
  };
  const noted = async () => {
    setBusy(true);
    setNote(null);
    const result = await createAccount(proposal);
    if (result === "renew") {
      // Ran out or taken meanwhile: a new one, to be noted again.
      const fresh = await proposeAccount(lang);
      setBusy(false);
      if (fresh.proposal) {
        setCopied(false);
        setNote("renewed");
        onRenew(fresh.proposal);
      } else setNote(fresh.result === "ok" ? "failed" : fresh.result);
      return;
    }
    setBusy(false);
    if (result === "ok") {
      trackEvent("account-created");
      onDone();
    } else setNote(result);
  };
  return (
    <div className="mt-3 grid gap-4">
      <h3 className="font-bold">{t("account.yourPassphrase")}</h3>
      <p className="rounded-2xl bg-surface-2 px-5 py-4 text-title leading-tight font-bold tracking-tight wrap-anywhere select-all">
        {passphrase}
      </p>
      <p className="text-muted">{t("account.keepIt")}</p>
      {note && (
        <p aria-live="polite" className="text-small font-bold">
          {t(note === "renewed" ? "account.renewed" : `account.${note}`)}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2.5 max-xs:*:grow">
        <Button
          className="mr-auto"
          disabled={busy}
          onClick={cancel}
          title={t("account.cancelHint")}
          type="button"
        >
          {t("account.cancel")}
        </Button>
        <Button disabled={busy} onClick={copy} type="button">
          <CookieIcon
            className={cookieInButton}
            icing={copied ? "#00b86b" : "#2a44ff"}
            icon={copied ? Check : Copy}
            key={copied ? "ok" : "copy"}
            size={48}
          />
          {copied ? t("account.copied") : t("account.copy")}
        </Button>
        <Button disabled={busy} kind="primary" onClick={noted} type="button">
          <CookieIcon
            className={cookieInButton}
            icon={Check}
            roll={-8}
            size={48}
            spin={busy}
          />
          {t("account.noted")}
        </Button>
      </div>
    </div>
  );
};

/**
 * Logged in: how many cookies are online, when it goes – log this device
 * out (the online cookies leave it), or delete the account (they stay on
 * this device, offline, their short links gone).
 */
/**
 * The passphrase as this browser keeps it (made or typed here) – behind a
 * button, with copying.
 */
const KeptPassphrase = ({ passphrase }: { passphrase: string }) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(passphrase);
      setCopied(true);
    } catch {
      window.prompt(t("account.yourPassphrase"), passphrase);
    }
  };
  if (!shown) {
    return (
      <Button
        className="justify-self-start"
        kind="ghost"
        onClick={() => setShown(true)}
        title={t("account.passphraseHere")}
        type="button"
      >
        <CookieIcon
          className={cookieInButton}
          icing="#ffc31f"
          icon={KeyRound}
          roll={-14}
          size={40}
        />
        {t("account.showPassphrase")}
      </Button>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="rounded-2xl bg-surface-2 px-5 py-3 text-lead leading-tight font-bold tracking-tight wrap-anywhere select-all">
        {passphrase}
      </p>
      <p className="text-small text-muted">{t("account.passphraseHere")}</p>
      <div className="flex flex-wrap justify-end gap-2.5 max-xs:*:grow">
        <Button onClick={() => setShown(false)} type="button">
          {t("account.hidePassphrase")}
        </Button>
        <Button onClick={copy} type="button">
          <CookieIcon
            className={cookieInButton}
            icing={copied ? "#00b86b" : "#2a44ff"}
            icon={copied ? Check : Copy}
            key={copied ? "ok" : "copy"}
            size={48}
          />
          {copied ? t("account.copied") : t("account.copy")}
        </Button>
      </div>
    </div>
  );
};

const Manage = () => {
  const { t } = useTranslation();
  const lang = useLang();
  const { goneAt, passphrase } = useSnapshot(account);
  const { jar } = useSnapshot(store);
  const online = jar.filter(({ code }) => code).length;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const date =
    goneAt &&
    new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(
      new Date(goneAt)
    );

  return (
    <div className="mt-3 grid gap-6">
      <div className="grid gap-1">
        <p className="font-bold">{t("account.loggedIn")}</p>
        <p className="text-muted">{t("account.online", { count: online })}</p>
      </div>
      <div className="grid gap-1 text-small text-muted">
        <p>{t("account.onlineHint")}</p>
        {date && <p>{t("account.goneAt", { date })}</p>}
      </div>
      {passphrase && <KeptPassphrase passphrase={passphrase} />}
      {confirming ? (
        <div className="grid gap-3 rounded-2xl bg-surface-2 p-4">
          <p className="font-bold">{t("account.confirmDelete")}</p>
          <div className="flex flex-wrap justify-end gap-2.5 max-xs:*:grow">
            <Button onClick={() => setConfirming(false)} type="button">
              {t("account.cancel")}
            </Button>
            <Button
              disabled={busy}
              kind="primary"
              onClick={async () => {
                setBusy(true);
                await deleteAccount();
                setBusy(false);
                setConfirming(false);
              }}
              type="button"
            >
              <CookieIcon
                className={cookieInButton}
                icing="#ff5fa8"
                icon={Trash2}
                roll={9}
                size={48}
              />
              {t("account.confirm")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2.5 max-xs:*:grow">
          <Button onClick={() => setConfirming(true)} type="button">
            <CookieIcon
              className={cookieInButton}
              icing="#ff5fa8"
              icon={Trash2}
              roll={9}
              size={48}
            />
            {t("account.delete")}
          </Button>
          <Button
            kind="primary"
            onClick={logOut}
            title={t("account.logOutHint")}
            type="button"
          >
            <CookieIcon
              className={cookieInButton}
              icing="#ffc31f"
              icon={LogOut}
              roll={-8}
              size={48}
            />
            {t("account.logOut")}
          </Button>
        </div>
      )}
    </div>
  );
};

const dialogRef = createRef<HTMLDialogElement>();

/** Opens the account – from the cookie jar, whose it is (cookie-bar.tsx). */
export const openAccount = () => openDialog(dialogRef);

/**
 * The account: where the cookies put online are kept (account/client.ts) –
 * a dialog to make one, log in with the passphrase, or see and leave it.
 * Mounted once; opened from the cookie bar and the share box (openAccount).
 * Closed without logging in, a cookie waiting to go online stays offline.
 */
const AccountDialog = () => {
  const { t } = useTranslation();
  const { state } = useSnapshot(account);
  /** Proposed: shown until noted or cancelled – also after closing. */
  const [fresh, setFresh] = useState<Proposal | null>(null);

  return (
    <Dialog
      label={t("account.title")}
      onClose={() => {
        // Closed without an account on its way: a waiting cookie stays offline.
        if (account.state !== "in" && !fresh) account.pending = null;
      }}
      ref={dialogRef}
    >
      <h2 className="pr-12 text-title leading-[1.2] font-bold tracking-title embolden-20">
        {t("account.title")}
      </h2>
      {fresh ? (
        <Fresh
          onDone={() => setFresh(null)}
          onRenew={setFresh}
          proposal={fresh}
        />
      ) : state === "in" ? (
        <Manage />
      ) : (
        <Welcome onProposed={setFresh} />
      )}
    </Dialog>
  );
};

export default AccountDialog;
