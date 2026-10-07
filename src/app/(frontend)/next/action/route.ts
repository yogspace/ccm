import { NextResponse } from "next/server";
import { isActionName } from "@/stats/actions";
import { cleanPath, counting } from "@/stats/count";
import { deviceClass } from "@/stats/device-class";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * Anonymous action beacon (analytics.ts): which action, on which page, the
 * device class – nothing else. Unknown names are ignored.
 */
export const dynamic = "force-dynamic";

const ok = () => new NextResponse(null, { status: 204 });

// More than anyone clicks in a minute – so nobody can fill the statistics.
// Beyond it the beacon is answered as usual, just not counted.
const tooMany = rateLimit({ limit: 60, windowMs: 60 * 1000 });

export const POST = async (request: Request) => {
  if (tooMany(clientIp(request))) return ok();
  const payload = await counting(request);
  if (!payload) return ok();

  let body: { name?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!isActionName(body.name)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    await payload.create({
      collection: "actions",
      overrideAccess: true,
      data: {
        name: body.name,
        path: cleanPath(body.path),
        device: deviceClass(request.headers.get("user-agent") ?? ""),
      },
    });
  } catch (error) {
    console.error("[action] could not record the action:", error);
  }
  return ok();
};
