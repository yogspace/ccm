import { NextResponse } from "next/server";
import { failure, fromThisSite, signOut } from "@/account/server";

/** Logging out: the login cookie goes – the account stays. */
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  return signOut(NextResponse.json({ ok: true }));
};
