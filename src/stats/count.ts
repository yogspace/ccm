import configPromise from "@payload-config";
import { getPayload, type Payload } from "payload";
import { isLoggedIn } from "./auth";
import { isBot } from "./device-class";
import { isExcludedDevice } from "./exclude";

/**
 * Whether a beacon counts – and if so the Payload instance to write with.
 * Not counted:
 *   - machines (crawlers, link previews),
 *   - browsers sending Global Privacy Control (`Sec-GPC: 1`),
 *   - the owner: logged in to the admin, or an excluded device
 *     (stats/exclude.ts) – building and checking one's own pages would skew
 *     the small numbers.
 */
export const counting = async (request: Request): Promise<Payload | null> => {
  if (isBot(request.headers.get("user-agent") ?? "")) return null;
  if (request.headers.get("sec-gpc") === "1") return null;
  const payload = await getPayload({ config: configPromise });
  if (await isLoggedIn(payload)) return null;
  if (await isExcludedDevice(payload)) return null;
  return payload;
};

/** Only the pathname – never a query or hash (the hash holds the drawing). */
export const cleanPath = (value: unknown): string | null => {
  const path = typeof value === "string" ? value.trim().split(/[?#]/)[0] : "";
  return path.startsWith("/") && path.length <= 200 ? path : null;
};
