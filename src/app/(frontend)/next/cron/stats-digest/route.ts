import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { denyUnlessAuthorized } from "@/stats/auth";
import { sendMail } from "@/stats/send-mail";
import { buildDigest } from "./digest";

/**
 * The statistics report by mail. Called daily by a cron on the server
 * (scripts/setup-cron.sh), but only sends when the interval set in the admin
 * (analytics global → Email report) is due, tracked by lastDigestAt. Then it
 * prunes rows older than 90 days.
 *
 * `?force=1` (the “send now” button): ignores interval and “off” and does
 * NOT move lastDigestAt, so the regular cadence stays.
 */
export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RETENTION_MS = 90 * DAY_MS;

const INTERVAL: Record<
  string,
  { minElapsedMs: number; windowMs: number; label: string }
> = {
  daily: { minElapsedMs: 20 * HOUR_MS, windowMs: DAY_MS, label: "Tages" },
  weekly: { minElapsedMs: 6 * DAY_MS, windowMs: 7 * DAY_MS, label: "Wochen" },
  monthly: {
    minElapsedMs: 27 * DAY_MS,
    windowMs: 30 * DAY_MS,
    label: "Monats",
  },
};

export const GET = async (request: Request) => {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const payload = await getPayload({ config: configPromise });

  // The cron's CRON_SECRET – or a logged-in admin (the button).
  const denied = await denyUnlessAuthorized(request, {
    payload,
    secret: process.env.CRON_SECRET,
  });
  if (denied) return denied;

  const now = Date.now();
  const settings = await payload.findGlobal({
    slug: "analytics",
    overrideAccess: true,
  });

  // Pruned on every call – also when no report is due or mail is off.
  let pruned = 0;
  try {
    const cutoff = new Date(now - RETENTION_MS).toISOString();
    for (const collection of ["page-views", "actions"] as const) {
      const result = await payload.delete({
        collection,
        where: { createdAt: { less_than: cutoff } },
        overrideAccess: true,
      });
      pruned += result.docs?.length ?? 0;
    }
  } catch (error) {
    console.error("[stats-digest] pruning failed:", error);
  }

  const interval =
    INTERVAL[settings.reportInterval ?? "off"] ??
    (force ? INTERVAL.weekly : null);
  if (!interval) return NextResponse.json({ skipped: "disabled", pruned });

  const lastAt = settings.lastDigestAt
    ? new Date(settings.lastDigestAt).getTime()
    : null;
  if (!force && lastAt && now - lastAt < interval.minElapsedMs) {
    return NextResponse.json({ skipped: "not due", pruned });
  }

  const recipient = process.env.MAIL_STATS_RECIPIENT;
  if (!recipient) {
    return NextResponse.json(
      { error: "No recipient configured (MAIL_STATS_RECIPIENT)" },
      { status: 500 }
    );
  }

  const sinceMs = force
    ? now - interval.windowMs
    : (lastAt ?? now - interval.windowMs);
  const { subject, text, html, total } = await buildDigest(payload, {
    sinceMs,
    now,
    interval,
  });

  const result = await sendMail({ to: recipient, subject, text, html });
  if (!result.ok) {
    const status = result.error === "Mail not configured" ? 500 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!force) {
    await payload.updateGlobal({
      slug: "analytics",
      data: { lastDigestAt: new Date(now).toISOString() },
      overrideAccess: true,
    });
  }
  return NextResponse.json({ total, pruned });
};
