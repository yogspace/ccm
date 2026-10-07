import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { BasePayload } from "payload";

/**
 * “Don't count this device” – the owner's own devices out of the statistics,
 * even when not logged in (on the phone one rarely is).
 *
 * One token for ALL devices: it lies in the analytics global, and every
 * device carrying it in the cookie is not counted. A new token makes every
 * old cookie worthless – then each device counts again until excluded anew.
 * The token says nothing about a device: all own devices carry the same one,
 * visitors none.
 */
export const EXCLUDE_COOKIE = "ccm-analytics-exclude";

/** The analytics global's field holding the current token. */
const TOKEN_FIELD = "analyticsExcludeToken";

// Browsers cap cookies at 400 days anyway (Chrome, Safari). Every click on
// “exclude” renews it.
const MAX_AGE_S = 400 * 24 * 60 * 60;

export const readExcludeToken = async (
  payload: BasePayload
): Promise<string | null> => {
  const analytics = (await payload.findGlobal({
    slug: "analytics",
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>;
  const token = analytics[TOKEN_FIELD];
  return typeof token === "string" && token ? token : null;
};

/**
 * Straight at the model instead of `payload.updateGlobal()`: the analytics
 * global is open in the admin exactly when the button is pressed, and a
 * regular update would bump `updatedAt` and make the open form claim someone
 * else changed it. This writes the one field and nothing else.
 */
export const writeExcludeToken = async (
  payload: BasePayload,
  token: string
): Promise<void> => {
  const globals = (
    payload.db as unknown as {
      globals: {
        updateOne: (
          filter: unknown,
          update: unknown,
          options?: unknown
        ) => Promise<unknown>;
      };
    }
  ).globals;
  await globals.updateOne(
    { globalType: "analytics" },
    { $set: { [TOKEN_FIELD]: token } },
    // `strict: false`: the base model of all globals does not know the field,
    // only the analytics global's does – Mongoose would drop it silently.
    { upsert: true, strict: false }
  );
};

export const newExcludeToken = (): string =>
  randomBytes(24).toString("base64url");

export const setExcludeCookie = async (token: string): Promise<void> => {
  (await cookies()).set(EXCLUDE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
};

export const clearExcludeCookie = async (): Promise<void> => {
  (await cookies()).delete(EXCLUDE_COOKIE);
};

/** Does this device carry the VALID token? An outdated one does not count. */
export const isExcludedDevice = async (
  payload: BasePayload
): Promise<boolean> => {
  const cookie = (await cookies()).get(EXCLUDE_COOKIE)?.value;
  if (!cookie) return false;
  try {
    return cookie === (await readExcludeToken(payload));
  } catch {
    return false;
  }
};
