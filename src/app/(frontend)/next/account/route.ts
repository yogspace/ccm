import { type NextRequest, NextResponse } from "next/server";
import {
  accountData,
  currentAccount,
  failure,
  fromThisSite,
  getAccountsPayload,
  signIn,
  signOut,
} from "@/account/server";

/**
 * The logged-in account (account/server.ts).
 * GET: its cookie jar, short links and when it goes – a visit, so the login
 * and the account's time start afresh. 401 without a login.
 * DELETE: the account goes, with its jar and short links.
 */
export const dynamic = "force-dynamic";

export const GET = async (request: NextRequest) => {
  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return signOut(failure("Not logged in", 401));
  return signIn(NextResponse.json(accountData(account)), account.id);
};

export const DELETE = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return signOut(failure("Not logged in", 401));
  // Its short links go along (collections/accounts.ts).
  await payload.delete({
    collection: "accounts",
    id: account.id,
    overrideAccess: true,
  });
  return signOut(NextResponse.json({ ok: true }));
};
