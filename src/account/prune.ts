import type { Payload } from "payload";
import { DAY_MS, EMPTY_DAYS, IDLE_DAYS } from "./rules";

/**
 * Accounts nobody visits any more go, with everything in them: after
 * IDLE_DAYS without a visit, or after EMPTY_DAYS if they never kept a cookie
 * or a short link – unless kept forever in the admin. Their short links go
 * along (collections/accounts.ts).
 */
export const pruneAccounts = async (payload: Payload, now = Date.now()) => {
  const before = (days: number) => new Date(now - days * DAY_MS).toISOString();

  const pruneable = { keep: { not_equals: true } };

  const idle = await payload.delete({
    collection: "accounts",
    where: {
      and: [pruneable, { lastSeenAt: { less_than: before(IDLE_DAYS) } }],
    },
    overrideAccess: true,
  });

  // Never kept anything: no cookies – and no short links either.
  const { docs: empty } = await payload.find({
    collection: "accounts",
    where: {
      and: [
        pruneable,
        { lastSeenAt: { less_than: before(EMPTY_DAYS) } },
        { cookies: { equals: 0 } },
      ],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  });
  let unused = 0;
  for (const account of empty) {
    const { totalDocs } = await payload.count({
      collection: "short-links",
      where: { account: { equals: account.id } },
      overrideAccess: true,
    });
    if (totalDocs > 0) continue;
    await payload.delete({
      collection: "accounts",
      id: account.id,
      overrideAccess: true,
    });
    unused++;
  }

  return { idle: idle.docs.length, unused };
};
