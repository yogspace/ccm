import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { isLoggedIn } from "@/stats/auth";
import {
  clearExcludeCookie,
  isExcludedDevice,
  newExcludeToken,
  readExcludeToken,
  setExcludeCookie,
  writeExcludeToken,
} from "@/stats/exclude";

/**
 * One's own devices out of the statistics (stats/exclude.ts) – only logged
 * in: who may set or renew the token decides whose visits disappear.
 *
 *   GET              → { excluded, hasToken } for THIS device
 *   POST { action }  → "exclude": cookie with the current token (created if
 *                      there is none yet)
 *                      "rotate": new token, all old cookies expire; this
 *                      device stays excluded
 *                      "include": cookie removed on this device
 */
export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const GET = async () => {
  const payload = await getPayload({ config: configPromise });
  if (!(await isLoggedIn(payload))) return unauthorized();
  return NextResponse.json({
    excluded: await isExcludedDevice(payload),
    hasToken: Boolean(await readExcludeToken(payload)),
  });
};

export const POST = async (request: Request) => {
  const payload = await getPayload({ config: configPromise });
  if (!(await isLoggedIn(payload))) return unauthorized();

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.action === "include") {
    await clearExcludeCookie();
    return NextResponse.json({ excluded: false });
  }
  if (body.action === "exclude" || body.action === "rotate") {
    let token =
      body.action === "exclude" ? await readExcludeToken(payload) : null;
    if (!token) {
      token = newExcludeToken();
      await writeExcludeToken(payload, token);
    }
    await setExcludeCookie(token);
    return NextResponse.json({ excluded: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
};
