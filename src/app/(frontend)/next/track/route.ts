import { NextResponse } from "next/server";
import { TRACKING } from "@/stats/config";
import { cleanId, cleanPath, counting } from "@/stats/count";
import {
  browserLabel,
  deviceClass,
  languageOf,
  osLabel,
  sourceOf,
} from "@/stats/device-class";
import { locationOf } from "@/stats/location";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * Anonymous page-view beacon (analytics.ts). Stores ONLY coarse dimensions –
 * page, source group, device class, system, browser – no IP, no cookie (see
 * collections/page-views.ts), plus what stats/config.ts switches on.
 * Country, region and city come from the IP (stats/location.ts), which is
 * only looked up and then dropped.
 */
export const dynamic = "force-dynamic";

const ok = () => new NextResponse(null, { status: 204 });

// More than anyone clicks in a minute – so nobody can fill the statistics.
// Beyond it the beacon is answered as usual, just not counted.
const tooMany = rateLimit({ limit: 60, windowMs: 60 * 1000 });

const cleanCampaign = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const parts = value
    .slice(0, 3)
    .map((part) =>
      typeof part === "string" ? part.trim().toLowerCase().slice(0, 60) : ""
    );
  return parts.some(Boolean)
    ? parts.map((part) => part || "–").join(" · ")
    : null;
};

export const POST = async (request: Request) => {
  const ip = clientIp(request);
  if (tooMany(ip)) return ok();
  const payload = await counting(request);
  if (!payload) return ok();

  let body: {
    path?: unknown;
    ref?: unknown;
    view?: unknown;
    visit?: unknown;
    step?: unknown;
    campaign?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const path = cleanPath(body.path);
  if (!path) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const agent = request.headers.get("user-agent") ?? "";
  const ownHost = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  )
    .split(":")[0]
    .replace(/^www\./, "");
  const step = Number(body.step);
  // Country, region, city – the IP only looked up, never stored.
  const location = TRACKING.origin
    ? await locationOf(request.headers, ip)
    : null;

  try {
    await payload.create({
      collection: "page-views",
      overrideAccess: true,
      data: {
        path,
        referrer: sourceOf(
          typeof body.ref === "string" ? body.ref : undefined,
          ownHost
        ),
        device: deviceClass(agent),
        os: osLabel(agent),
        browser: browserLabel(agent),
        ...(location
          ? {
              ...location,
              language: languageOf(request.headers.get("accept-language")),
            }
          : {}),
        ...(TRACKING.campaigns
          ? { campaign: cleanCampaign(body.campaign) }
          : {}),
        ...(TRACKING.timing ? { view: cleanId(body.view) } : {}),
        ...(TRACKING.visits
          ? {
              visit: cleanId(body.visit),
              step:
                Number.isInteger(step) && step > 0 && step < 1000 ? step : null,
            }
          : {}),
      },
    });
  } catch (error) {
    // Statistics never break the page – report success regardless.
    console.error("[track] could not record the view:", error);
  }
  return ok();
};
