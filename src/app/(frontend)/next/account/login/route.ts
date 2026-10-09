import { type NextRequest, NextResponse } from "next/server";
import {
  accountData,
  bodyOf,
  failure,
  fromThisSite,
  getAccountsPayload,
  keyOf,
  normalizePassphrase,
  signIn,
} from "@/account/server";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * Logging in with the passphrase – the account is found by its key. Slow
 * (scrypt) and limited per IP and altogether, so passphrases can't be
 * tried through.
 */
export const dynamic = "force-dynamic";

// Ten tries per IP in ten minutes; a thousand an hour altogether.
const tooMany = rateLimit({ limit: 10, windowMs: 10 * 60 * 1000 });
const tooManyAll = rateLimit({ limit: 1000, windowMs: 60 * 60 * 1000 });

export const POST = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request)) || tooManyAll("all")) {
    return failure("Too many requests", 429);
  }
  const { passphrase } = await bodyOf(request);
  if (typeof passphrase !== "string" || passphrase.length > 300) {
    return failure("Invalid passphrase", 400);
  }
  if (normalizePassphrase(passphrase).split("-").length < 3) {
    return failure("Unknown passphrase", 401);
  }
  const payload = await getAccountsPayload();
  const { docs } = await payload.find({
    collection: "accounts",
    where: { key: { equals: await keyOf(passphrase) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  if (!docs[0]) return failure("Unknown passphrase", 401);
  const account = await payload.update({
    collection: "accounts",
    id: docs[0].id,
    data: {
      lastSeenAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  });
  return signIn(NextResponse.json(accountData(account)), account.id);
};
