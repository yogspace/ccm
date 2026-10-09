import { proxy, ref } from "valtio";
import { trackEvent } from "../analytics";
import { type SavedCookie, trimJar } from "../cookie-jar";
import { shapeOf, shortened } from "../short-shape";
import { eatCookie, store } from "../store";
import { type AccountData, isSavedCookie, modelOf } from "./rules";

/**
 * The account in the browser. Each cookie in the jar is only here or online
 * (its `code`): online, it is kept in the account too – on every device
 * logged in – and has a short link; shared, its link is short. Taken back,
 * it is only here again and its short link leads nowhere. The first cookie
 * put online makes the account (account-dialog.tsx); logging out takes the
 * online cookies off this device, deleting the account keeps them here.
 */

type State = "unknown" | "out" | "in";

export const account = proxy({
  state: "unknown" as State,
  /** When it goes without another visit (ISO). */
  goneAt: null as string | null,
  /** A cookie to put online once logged in (its hash). */
  pending: null as string | null,
  /** Cookies on their way online or back (their hashes). */
  busy: [] as string[],
  /** The passphrase, if this browser knows it (see keepPassphrase). */
  passphrase: null as string | null,
});

/**
 * The passphrase, kept in this browser – to look it up in the account. Only
 * here: the server knows its key alone. Logging out or deleting forgets it.
 */
const PASSPHRASE = "ccm.account.passphrase";
const keepPassphrase = (phrase: string | null) => {
  account.passphrase = phrase;
  try {
    if (phrase) localStorage.setItem(PASSPHRASE, phrase);
    else localStorage.removeItem(PASSPHRASE);
  } catch {
    // Then it is only known until the page closes.
  }
};
const keptPassphrase = () => {
  try {
    return localStorage.getItem(PASSPHRASE);
  } catch {
    return null;
  }
};

/** Logged in in this browser last time? Then the server is asked. */
const FLAG = "ccm.account";
const remember = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    // Then it asks again on the next visit – no harm.
  }
};
const remembered = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

type Answer = { ok: boolean; status: number; body: Record<string, unknown> };

const call = async (path: string, init?: RequestInit): Promise<Answer> => {
  try {
    const response = await fetch(`/next/account${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: {} };
  }
};

/** A cookie in the jar online (`code`) or only here again (none). */
const setCode = (hash: string, code?: string) => {
  store.jar = ref(
    store.jar.map((cookie) => {
      if (cookie.hash !== hash) return cookie;
      const { code: _, ...only } = cookie;
      return code ? { ...only, code } : only;
    })
  );
};

const working = async <T>(hash: string, work: () => Promise<T>) => {
  account.busy = [...account.busy, hash];
  try {
    return await work();
  } finally {
    account.busy = account.busy.filter((other) => other !== hash);
  }
};

/**
 * The account's data arrived: its online cookies are the ones – on another
 * device one may have been taken back or eaten; the cookies only here stay.
 */
const loggedIn = (data: AccountData) => {
  const online = data.jar.filter(isSavedCookie).filter(({ code }) => code);
  const known = new Set(online.map(({ hash }) => hash));
  const here = store.jar.filter(({ hash, code }) => !(code || known.has(hash)));
  account.state = "in";
  account.goneAt = data.goneAt;
  store.jar = ref(
    trimJar([...online, ...here].sort((a, b) => b.savedAt - a.savedAt))
  );
  remember(true);
  const { pending } = account;
  account.pending = null;
  if (pending) putOnline(pending);
};

/**
 * Logged out – `leave`: the online cookies go from this device (they are
 * the account's, and this may be someone else's device).
 */
const loggedOut = (leave: boolean) => {
  account.state = "out";
  account.goneAt = null;
  remember(false);
  if (leave) {
    store.jar = ref(store.jar.filter(({ code }) => !code));
    if (store.jar.length === 0) store.jarOpen = false;
  }
};

/** Starts the account in the editor: logged in last time, it is asked. */
export const startAccount = () => {
  account.passphrase = keptPassphrase();
  if (!remembered()) {
    account.state = "out";
    return;
  }
  call("").then(({ ok, status, body }) => {
    if (ok) loggedIn(body as AccountData);
    // The login ran out: the jar here stays as it is.
    else if (status === 401) loggedOut(false);
    else account.state = "out";
  });
};

export type LoginResult = "ok" | "unknown" | "tooMany" | "failed";

const result = ({ ok, status }: Answer): LoginResult =>
  ok
    ? "ok"
    : status === 401
      ? "unknown"
      : status === 429
        ? "tooMany"
        : "failed";

/** A passphrase proposed for a new account – nothing is made yet. */
export type Proposal = { passphrase: string; token: string };

export const proposeAccount = async (lang: string) => {
  const answer = await call("/propose", {
    method: "POST",
    body: JSON.stringify({ lang }),
  });
  if (!answer.ok) return { result: result(answer), proposal: null };
  return {
    result: "ok" as const,
    proposal: {
      passphrase: String(answer.body.passphrase),
      token: String(answer.body.token),
    },
  };
};

export type CreateResult = LoginResult | "renew";

/**
 * The account, made once its passphrase is noted – "renew": the proposal
 * ran out or was taken meanwhile, a new one is needed.
 */
export const createAccount = async (proposal: Proposal) => {
  const answer = await call("/create", {
    method: "POST",
    body: JSON.stringify(proposal),
  });
  if (answer.ok) {
    loggedIn(answer.body as AccountData);
    keepPassphrase(proposal.passphrase);
  }
  return answer.status === 400 || answer.status === 409
    ? "renew"
    : result(answer);
};

export const logIn = async (passphrase: string) => {
  const answer = await call("/login", {
    method: "POST",
    body: JSON.stringify({ passphrase }),
  });
  if (answer.ok) {
    loggedIn(answer.body as AccountData);
    // As typed, tidied: lower case, hyphens between the parts.
    keepPassphrase(
      passphrase
        .trim()
        .toLowerCase()
        .replace(/[\s,]+/g, "-")
    );
    trackEvent("account-login");
  }
  return result(answer);
};

export const logOut = async () => {
  await call("/logout", { method: "POST" });
  loggedOut(true);
  keepPassphrase(null);
  trackEvent("account-logout");
};

/**
 * The account goes – with its short links; its cookies stay here, only here
 * now. Also right after making one, to take it back.
 */
export const deleteAccount = async () => {
  const { ok, status } = await call("", { method: "DELETE" });
  if (ok || status === 401) {
    loggedOut(false);
    store.jar = ref(store.jar.map(({ code: _, ...cookie }) => cookie));
  }
  if (ok) keepPassphrase(null);
  if (ok) trackEvent("account-deleted");
  return ok;
};

export type OnlineResult = "ok" | "login" | "full" | "failed";

/**
 * Puts a cookie online: into the account, with a short link. Not logged in:
 * "login" – it follows once logged in (account.pending).
 */
export const putOnline = async (hash: string): Promise<OnlineResult> => {
  const cookie = store.jar.find((other) => other.hash === hash);
  if (!cookie || cookie.code) return "ok";
  if (account.state !== "in") {
    account.pending = hash;
    return "login";
  }
  const { ok, status, body } = await working(hash, () =>
    call("/links", { method: "POST", body: JSON.stringify({ cookie }) })
  );
  if (ok) {
    setCode(hash, String(body.code));
    trackEvent("cookie-online");
    return "ok";
  }
  if (status === 401) loggedOut(false);
  return status === 409 ? "full" : "failed";
};

/**
 * The model the page was opened with: a changed version of an online cookie
 * opened here can take over its short link (replaceOnline).
 */
let opened = modelOf(window.location.hash);

/**
 * The online cookie a just saved version was made from – changed – if there
 * is one: its short link could show this version instead.
 */
export const replacedBy = (hash: string) => {
  const model = modelOf(hash);
  if (!opened || !model || model === opened) return undefined;
  return store.jar.find(
    (other) =>
      other.code && other.hash !== hash && modelOf(other.hash) === opened
  );
};

/**
 * Puts a changed version online in place of the cookie it was made from:
 * the same short link shows it from now on – for everyone who has it –
 * and the old cookie goes.
 */
export const replaceOnline = async (hash: string): Promise<OnlineResult> => {
  const saved = store.jar.find((other) => other.hash === hash);
  const old = replacedBy(hash);
  if (!saved || !old?.code) return "failed";
  // Opened by a bare short link, it has no name – the old one's, then.
  const cookie = { ...saved, name: saved.name || old.name };
  // Online cookies are here only logged in – the server says if no longer.
  const { ok, status, body } = await working(hash, () =>
    call("/links", {
      method: "PUT",
      body: JSON.stringify({ cookie, replaces: old.hash }),
    })
  );
  if (ok) {
    const code = String(body.code);
    store.jar = ref(
      store.jar
        .filter((other) => other.hash === hash || other.code !== code)
        .map((other) => (other.hash === hash ? { ...cookie, code } : other))
    );
    // Changed again, it is this version that takes over next.
    opened = modelOf(hash);
    trackEvent("cookie-replaced");
    return "ok";
  }
  if (status === 401) {
    loggedOut(false);
    return "login";
  }
  return "failed";
};

/** Out of the account, its short link gone – the cookie only here. */
const leaveAccount = async (hash: string) => {
  const { ok, status } = await working(hash, () =>
    call("/links", { method: "DELETE", body: JSON.stringify({ hash }) })
  );
  if (status === 401) loggedOut(false);
  if (ok) setCode(hash);
  return ok;
};

/** Back to this browser only: out of the account, its short link gone. */
export const takeBack = async (hash: string) => {
  const ok = await leaveAccount(hash);
  if (ok) trackEvent("cookie-offline");
  return ok;
};

/** Eats a cookie – online, it leaves the account first. */
export const eatEverywhere = async (hash: string) => {
  const cookie = store.jar.find((other) => other.hash === hash);
  if (cookie?.code && !(await leaveAccount(hash))) return false;
  eatCookie(hash);
  return true;
};

/** The cookie online that a link's model belongs to, if there is one. */
const onlineCookieOf = (jar: readonly SavedCookie[], url: string) => {
  const shape = shapeOf(url);
  return shape
    ? jar.find(({ hash, code }) => code && modelOf(hash) === shape)
    : undefined;
};

/** The link to share: short, if its creation is online – else as it is. */
export const shareLinkOf = (jar: readonly SavedCookie[], url: string) => {
  const code = onlineCookieOf(jar, url)?.code;
  return code ? shortened(url, code) : url;
};
