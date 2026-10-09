import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import configPromise from "@payload-config";
import { type NextRequest, NextResponse } from "next/server";
import { getPayload, type Payload } from "payload";
import type { Account } from "../payload-types";
import { keyOf, newPassphrase, normalizePassphrase, secret } from "./keys";
import {
  type AccountData,
  CODE_CHARS,
  CODE_LENGTH,
  DAY_MS,
  goneAt,
  isSavedCookie,
  SESSION_DAYS,
} from "./rules";

export { keyOf, newPassphrase, normalizePassphrase };

/**
 * Accounts on the server: no name, no email – a passphrase of three plain
 * words, some with a number, made here and shown once; the account follows
 * once it is noted. The database keeps only its key: scrypt,
 * peppered with the server's secret – from the database alone no passphrase
 * can be guessed back. A login is a signed cookie (httpOnly) with the
 * account's id and when it runs out.
 */

export const getAccountsPayload = () => getPayload({ config: configPromise });

/** A short link's code – random, letters and digits. */
export const newCode = () =>
  Array.from(
    { length: CODE_LENGTH },
    () => CODE_CHARS[randomInt(CODE_CHARS.length)]
  ).join("");

// ─── The login cookie ───────────────────────────────────────────────────────

const COOKIE = "ccm-account";

const sign = (payload: string) =>
  createHmac("sha256", secret())
    .update(`account:${payload}`)
    .digest("base64url");

/** A signature as it should be – compared in constant time. */
const matches = (expected: string, given: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

// ─── Proposals ──────────────────────────────────────────────────────────────

/** How long a proposed passphrase can still become an account. */
const PROPOSAL_MS = 60 * 60 * 1000;

const proposal = (phrase: string, until: string | number) =>
  sign(`proposal:${normalizePassphrase(phrase)}.${until}`);

/**
 * A passphrase proposed, not kept: the account is made only once it is
 * noted (create/route.ts) – with this token, so only passphrases made here
 * become accounts.
 */
export const proposalToken = (phrase: string) => {
  const until = Date.now() + PROPOSAL_MS;
  return `${until}.${proposal(phrase, until)}`;
};

/** Proposed here, not too long ago? */
export const isProposed = (phrase: string, token: string) => {
  const [until, signature] = token.split(".");
  if (!(until && signature) || Number(until) < Date.now()) return false;
  return matches(proposal(phrase, until), signature);
};

/** Is a passphrase's key taken already? */
export const isTaken = async (payload: Payload, key: string) =>
  (
    await payload.count({
      collection: "accounts",
      where: { key: { equals: key } },
      overrideAccess: true,
    })
  ).totalDocs > 0;

/** The account's id from the login cookie – null if none, or not ours. */
const sessionOf = (request: NextRequest) => {
  const value = request.cookies.get(COOKIE)?.value;
  const [id, until, signature] = value?.split(".") ?? [];
  if (!(id && until && signature)) return null;
  if (!matches(sign(`${id}.${until}`), signature)) return null;
  return Number(until) > Date.now() ? id : null;
};

/** Logged in (again): the cookie for another SESSION_DAYS. */
export const signIn = (response: NextResponse, id: string) => {
  const until = Date.now() + SESSION_DAYS * DAY_MS;
  response.cookies.set(COOKIE, `${id}.${until}.${sign(`${id}.${until}`)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
};

export const signOut = (response: NextResponse) => {
  response.cookies.delete(COOKIE);
  return response;
};

/**
 * The logged-in account – null without a login, or if it is gone. A visit
 * counts: it is seen now (at most once an hour written).
 */
export const currentAccount = async (
  request: NextRequest,
  payload: Payload
): Promise<Account | null> => {
  const id = sessionOf(request);
  if (!id) return null;
  try {
    const account = await payload.findByID({
      collection: "accounts",
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (Date.now() - new Date(account.lastSeenAt).getTime() > 60 * 60 * 1000) {
      return await payload.update({
        collection: "accounts",
        id,
        data: { lastSeenAt: new Date().toISOString() },
        depth: 0,
        overrideAccess: true,
      });
    }
    return account;
  } catch {
    return null;
  }
};

/** The cookies an account keeps online – each with its short link's code. */
export const onlineJar = (account: Account) =>
  (Array.isArray(account.jar) ? account.jar : []).filter(isSavedCookie);

/** What the browser gets of the account: its online cookies, its end. */
export const accountData = (account: Account): AccountData => ({
  jar: onlineJar(account),
  goneAt: account.keep ? null : goneAt(account.lastSeenAt).toISOString(),
});

// ─── Requests ───────────────────────────────────────────────────────────────

/**
 * Sent by this site's own pages? Changes come only from there – with the
 * login cookie being SameSite=Lax, a second line against forged requests.
 */
export const fromThisSite = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const failure = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/** The request's JSON body – an empty object if it has none. */
export const bodyOf = async (request: Request) => {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
