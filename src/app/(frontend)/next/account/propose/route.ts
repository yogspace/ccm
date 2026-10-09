import { NextResponse } from "next/server";
import {
  bodyOf,
  failure,
  fromThisSite,
  getAccountsPayload,
  isTaken,
  keyOf,
  newPassphrase,
  proposalToken,
} from "@/account/server";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * A passphrase for a new account – proposed, nothing kept: the account is
 * made only once it is noted (create/route.ts), with the token that comes
 * along.
 */
export const dynamic = "force-dynamic";

// Thirty an hour per IP.
const tooMany = rateLimit({ limit: 30, windowMs: 60 * 60 * 1000 });

export const POST = async (request: Request) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request))) return failure("Too many requests", 429);
  const { lang } = await bodyOf(request);
  const payload = await getAccountsPayload();
  // Two alike are next to impossible – but then, another one.
  for (let attempt = 0; attempt < 3; attempt++) {
    const passphrase = newPassphrase(lang === "de" ? "de" : "en");
    if (await isTaken(payload, await keyOf(passphrase))) continue;
    return NextResponse.json({ passphrase, token: proposalToken(passphrase) });
  }
  return failure("No passphrase found", 500);
};
