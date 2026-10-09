import type { SavedCookie } from "../cookie-jar";

/**
 * Accounts – for browser and server alike: how long they last, what they
 * hold. An account has no name and no email: a passphrase of a few words is
 * all (server.ts). It keeps the cookies put online – each with a short link
 * to its model; nothing else.
 */

/** Days without a visit, then the account goes with everything in it. */
export const IDLE_DAYS = 180;
/** An account that never kept anything goes after these many idle days. */
export const EMPTY_DAYS = 7;
/**
 * Cookies a jar keeps – the oldest make room beyond this many; online, an
 * account keeps as many.
 */
export const JAR_SIZE = 30;
/** Words in a passphrase – and the numbers some get, from and to. */
export const PASSPHRASE_WORDS = 3;
export const PASSPHRASE_NUMBER = [1, 99] as const;
/**
 * How long a login lasts in a browser without a visit (days) – as long as
 * the account; every visit starts it afresh.
 */
export const SESSION_DAYS = IDLE_DAYS;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** When an account last seen at `lastSeen` goes, unless visited again. */
export const goneAt = (lastSeen: Date | string | number) =>
  new Date(new Date(lastSeen).getTime() + IDLE_DAYS * DAY_MS);

/**
 * What the browser gets of its account: the cookies put online, each with
 * its short link's code – a short link stands for the model behind a link
 * (`s`); everything else in a shared link (name, size, for whom, from whom,
 * the message) stays in it and never reaches the server that way.
 */
export type AccountData = {
  jar: SavedCookie[];
  /** When it goes without another visit (ISO) – null: kept forever. */
  goneAt: string | null;
};

/** The model a creation's hash carries (`s`) – what a short link keeps. */
export const modelOf = (hash: string) =>
  new URLSearchParams(hash.replace(/^#/, "")).get("s");

/** Short link codes: letters and digits, this long – about 42 bits. */
export const CODE_LENGTH = 7;
export const CODE_CHARS =
  "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const isCode = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === CODE_LENGTH &&
  [...value].every((char) => CODE_CHARS.includes(char));

/** A model as links carry it (url-state.ts): base64url, not overly long. */
export const isShape = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,16000}$/.test(value);

const isRings = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.every(
        (point) =>
          Array.isArray(point) &&
          point.length === 2 &&
          point.every((n) => typeof n === "number" && Number.isFinite(n))
      )
  );

/** A cookie from the jar (cookie-jar.ts) – as the browser keeps it. */
export const isSavedCookie = (value: unknown): value is SavedCookie => {
  const cookie = value as SavedCookie;
  return (
    typeof cookie?.hash === "string" &&
    cookie.hash.length <= 17000 &&
    (cookie.code === undefined || isCode(cookie.code)) &&
    typeof cookie.name === "string" &&
    cookie.name.length <= 200 &&
    typeof cookie.size === "number" &&
    typeof cookie.savedAt === "number" &&
    typeof cookie.shape?.seed === "number" &&
    isRings(cookie.shape.dough) &&
    isRings(cookie.shape.icing)
  );
};
