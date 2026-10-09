import { type NextRequest, NextResponse } from "next/server";
import {
  accountData,
  bodyOf,
  failure,
  fromThisSite,
  getAccountsPayload,
  isProposed,
  isTaken,
  keyOf,
  signIn,
} from "@/account/server";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * A new account – once its passphrase is noted: one proposed here
 * (propose/route.ts), its token along. The database keeps only its key.
 * Logged in right away; cookies go online one by one (links/route.ts).
 */
export const dynamic = "force-dynamic";

// At most five new accounts per IP an hour.
const tooMany = rateLimit({ limit: 5, windowMs: 60 * 60 * 1000 });

export const POST = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request))) return failure("Too many requests", 429);
  const { passphrase, token } = await bodyOf(request);
  if (
    !(typeof passphrase === "string" && typeof token === "string") ||
    !isProposed(passphrase, token)
  ) {
    return failure("Not proposed here, or too long ago", 400);
  }
  const payload = await getAccountsPayload();
  const key = await keyOf(passphrase);
  // Taken meanwhile (next to impossible): a new one is proposed.
  if (await isTaken(payload, key)) return failure("Taken", 409);
  const account = await payload.create({
    collection: "accounts",
    data: { key, lastSeenAt: new Date().toISOString(), jar: [], cookies: 0 },
    depth: 0,
    overrideAccess: true,
  });
  return signIn(NextResponse.json(accountData(account)), account.id);
};
