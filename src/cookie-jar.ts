import type { CookieShape } from "./cookies/models";
import type { Ring } from "./geometry/outline";
import { hashText } from "./hash-text";
import { simplifyRing } from "./url-state";

/**
 * Creations kept as cookies – the cookie bar. Only in this browser
 * (localStorage), never on the server: the link to open the creation again,
 * its name and size, and its contours to bake the cookie from.
 */
export type SavedCookie = {
  /** The creation's link hash (`#n=…&s=…`). */
  hash: string;
  name: string;
  /** Longest side in mm. */
  size: number;
  savedAt: number;
  shape: CookieShape;
};

const KEY = "ccm.cookies";
/** The oldest cookies make room beyond this many. */
export const JAR_SIZE = 30;
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
 * The same shape always bakes the same cookie (icing colour, sprinkles) – in
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
    typeof cookie.name === "string" &&
    typeof cookie.size === "number" &&
    Array.isArray(cookie.shape?.dough) &&
    Array.isArray(cookie.shape.icing)
  );
};

export const loadJar = (): SavedCookie[] => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isCookie) : [];
  } catch {
    return [];
  }
};

export const storeJar = (jar: readonly SavedCookie[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(jar.slice(0, JAR_SIZE)));
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
