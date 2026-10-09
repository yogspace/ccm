import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { isCode } from "@/account/rules";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * The model behind a short link (`#…&k=<code>`): fetched by the page before
 * it reads its link (short-shape.ts). 404 once it is gone – deleted, or its
 * account is.
 */
export const dynamic = "force-dynamic";

// Two a second per IP – plenty for people, too few to try codes through.
const tooMany = rateLimit({ limit: 120, windowMs: 60 * 1000 });

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  if (tooMany(clientIp(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { code } = await params;
  const payload = await getPayload({ config: configPromise });
  const { docs } = isCode(code)
    ? await payload.find({
        collection: "short-links",
        where: { code: { equals: code } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] };
  const link = docs[0];
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    { shape: link.shape },
    // Asked anew every time: switched to a new version (or deleted), a
    // short link shows that at once.
    { headers: { "Cache-Control": "private, no-cache" } }
  );
};
