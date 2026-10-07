import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { denyUnlessAuthorized } from "@/stats/auth";
import { seedTranslations } from "@/translations/seed";

/**
 * The missing translation keys – look (GET, a dry run that changes nothing)
 * and add (POST). The same as the run at every start, reachable from the
 * admin (fields/seed-translations-button.tsx). Existing values stay either
 * way – that is up to seedTranslations.
 */
export const dynamic = "force-dynamic";

const run = async (request: Request, apply: boolean) => {
  const payload = await getPayload({ config: configPromise });
  const denied = await denyUnlessAuthorized(request, { payload });
  if (denied) return denied;
  try {
    const reports = await seedTranslations(payload, { apply });
    return NextResponse.json({ applied: apply, reports });
  } catch (error) {
    payload.logger.error({ err: error, msg: "seed-translations failed" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};

export const GET = (request: Request) => run(request, false);

export const POST = (request: Request) => run(request, true);
