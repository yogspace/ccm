import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { pruneAccounts } from "@/account/prune";
import { denyUnlessAuthorized } from "@/stats/auth";

/**
 * Accounts nobody visits any more go, with everything in them
 * (account/prune.ts) – called daily by a cron on the server
 * (scripts/setup-cron.sh).
 */
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise });
  const denied = await denyUnlessAuthorized(request, {
    payload,
    secret: process.env.CRON_SECRET,
  });
  if (denied) return denied;

  return NextResponse.json(await pruneAccounts(payload));
};
