import { JAR_SIZE } from "./account/rules";
import type { CookieShape } from "./cookies/shape-cookie";
import type { Ring } from "./geometry/outline";
import { hashText } from "./hash-text";
import { currentForm } from "./link-keys";
import { simplifyRing } from "./url-state";

export { JAR_SIZE };

/**
 * Creations kept as cookies – the cookie bar. In this browser
 * (localStorage) – and, those put online, in the account too
 * (account/client.ts): the link to open the creation again, its name and
 * size, and its contours to bake the cookie from.
 */
export type SavedCookie = {
  /** The creation's link hash (`#n=…&s=…`). */
  hash: string;
  /**
   * Online: its short link's code – the cookie is kept in the account too,
   * on every device (account/client.ts). Without it, only in this browser.
   */
  code?: string;
  name: string;
  /** Longest side in mm. */
  size: number;
  savedAt: number;
  shape: CookieShape;
};

const KEY = "ccm.cookies";
/** Tolerance (share of the drawing area) when thinning the contours. */
const TOLERANCE = 0.0008;

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** Thinner contours for storage – a cookie in the bar needs no more. */
const pack = (rings: Ring[]): Ring[] =>
  rings
    .map((ring) =>
      simplifyRing(ring, TOLERANCE).map(([x, y]): [number, number] => [
        round(x),
        round(y),
      ])
    )
    .filter((ring) => ring.length >= 3);

/**
 * The same shape always bakes the same cookie (icing color, sprinkles) – in
 * the bar, on the save button and on the greeting card.
 */
export const cookieSeed = (outline: Ring[]) =>
  hashText(
    outline
      .flatMap((ring) => ring.filter((_, i) => i % 16 === 0))
      .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
      .join(";")
  );

export const bakeCookie = ({
  hash,
  name,
  size,
  outline,
  icing,
}: {
  hash: string;
  name: string;
  size: number;
  outline: Ring[];
  icing: Ring[];
}): SavedCookie => ({
  hash,
  name: name.trim(),
  size,
  savedAt: Date.now(),
  shape: {
    dough: pack(outline),
    icing: pack(icing),
    seed: cookieSeed(outline),
  },
});

const isCookie = (value: unknown): value is SavedCookie => {
  const cookie = value as SavedCookie;
  return (
    typeof cookie?.hash === "string" &&
    (cookie.code === undefined || typeof cookie.code === "string") &&
    typeof cookie.name === "string" &&
    typeof cookie.size === "number" &&
    Array.isArray(cookie.shape?.dough) &&
    Array.isArray(cookie.shape.icing)
  );
};

/**
 * At most JAR_SIZE cookies, newest first: beyond, the oldest that is only
 * here makes room – an online one only if there is none, so short links do
 * not go without a word.
 */
export const trimJar = (jar: readonly SavedCookie[]) => {
  const kept = [...jar];
  while (kept.length > JAR_SIZE) {
    const local = kept.findLastIndex((cookie) => !cookie.code);
    kept.splice(local === -1 ? kept.length - 1 : local, 1);
  }
  return kept;
};

export const loadJar = (): SavedCookie[] => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Saved from older links: their hash as written today.
    return Array.isArray(stored)
      ? stored
          .filter(isCookie)
          .map((cookie) => ({ ...cookie, hash: currentForm(cookie.hash) }))
      : [];
  } catch {
    return [];
  }
};

export const storeJar = (jar: readonly SavedCookie[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(trimJar(jar)));
  } catch {
    // Without storage the cookies last until the tab closes – no harm.
  }
};

const CLOSED_KEY = "ccm.jar-closed";

/** Closed in this session? A new visit shows the bar again. */
export const jarClosed = () => {
  try {
    return sessionStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
};

export const rememberJarClosed = (closed: boolean) => {
  try {
    if (closed) sessionStorage.setItem(CLOSED_KEY, "1");
    else sessionStorage.removeItem(CLOSED_KEY);
  } catch {
    // Then it opens again on the next load.
  }
};
