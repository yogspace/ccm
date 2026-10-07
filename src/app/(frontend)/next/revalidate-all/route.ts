import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { expireTags, TAGS } from "@/cache";
import { denyUnlessAuthorized } from "@/stats/auth";

/**
 * Expires every cached CMS content at once – after `pnpm payload:db:sync`
 * (the database changed under the app's feet) or by hand. Allowed with
 * `?secret=` (REVALIDATE_SECRET, otherwise PAYLOAD_SECRET) or for a logged-in
 * admin.
 */
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const payload = await getPayload({ config: configPromise });
  const denied = await denyUnlessAuthorized(request, {
    payload,
    secret: process.env.REVALIDATE_SECRET ?? process.env.PAYLOAD_SECRET,
  });
  if (denied) return denied;

  const tags = Object.values(TAGS);
  expireTags(...tags);
  return NextResponse.json({ revalidated: tags });
};
