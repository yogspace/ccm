import { type NextRequest, NextResponse } from "next/server";
import type { Payload } from "payload";
import { isSavedCookie, isShape, JAR_SIZE, modelOf } from "@/account/rules";
import {
  bodyOf,
  currentAccount,
  failure,
  fromThisSite,
  getAccountsPayload,
  newCode,
  onlineJar,
} from "@/account/server";
import { currentForm } from "@/link-keys";
import type { Account } from "@/payload-types";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * A cookie online, or back to the browser only (account/client.ts).
 * POST: the cookie goes into the account with a short link for its model –
 * one per model: the same again gets the code there is. PUT: a changed
 * version takes an online cookie's place, short link and all. DELETE: it
 * leaves the account; its short link goes with it, unless another cookie
 * online has the same model. A short link keeps only the model – what reaches the
 * public (`/next/shape/<code>`); the cookie's name stays the account's.
 */
export const dynamic = "force-dynamic";

// Sixty an hour per IP.
const tooMany = rateLimit({ limit: 60, windowMs: 60 * 60 * 1000 });

const keepJar = (payload: Payload, account: Account, jar: unknown[]) =>
  payload.update({
    collection: "accounts",
    id: account.id,
    data: { jar, cookies: jar.length },
    depth: 0,
    overrideAccess: true,
  });

export const POST = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request))) return failure("Too many requests", 429);
  const body = await bodyOf(request);
  if (!isSavedCookie(body.cookie)) return failure("Invalid cookie", 400);
  // Kept as links are written today, like the jar it joins (onlineJar).
  const cookie = { ...body.cookie, hash: currentForm(body.cookie.hash) };
  const shape = modelOf(cookie.hash);
  if (!isShape(shape)) return failure("Invalid shape", 400);
  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return failure("Not logged in", 401);

  const jar = onlineJar(account).filter((other) => other.hash !== cookie.hash);
  if (jar.length >= JAR_SIZE) return failure("Jar full", 409);

  const { docs } = await payload.find({
    collection: "short-links",
    where: {
      and: [{ account: { equals: account.id } }, { shape: { equals: shape } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  let code = docs[0]?.code;
  // A code taken already (next to impossible): another one.
  for (let attempt = 0; !code && attempt < 3; attempt++) {
    try {
      ({ code } = await payload.create({
        collection: "short-links",
        data: { code: newCode(), shape, account: account.id },
        depth: 0,
        overrideAccess: true,
      }));
    } catch {
      // The unique index said no – try again.
    }
  }
  if (!code) return failure("No code found", 500);

  await keepJar(payload, account, [{ ...cookie, code }, ...jar]);
  return NextResponse.json({ code });
};

/**
 * PUT: a changed version takes the place of an online cookie (`replaces`,
 * its hash): its short link shows the new model from now on, the old
 * cookie leaves the account.
 */
export const PUT = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request))) return failure("Too many requests", 429);
  const body = await bodyOf(request);
  if (!isSavedCookie(body.cookie) || typeof body.replaces !== "string") {
    return failure("Invalid cookie", 400);
  }
  const cookie = { ...body.cookie, hash: currentForm(body.cookie.hash) };
  const shape = modelOf(cookie.hash);
  if (!isShape(shape)) return failure("Invalid shape", 400);
  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return failure("Not logged in", 401);

  const all = onlineJar(account);
  const replaces = currentForm(body.replaces);
  const code = all.find((other) => other.hash === replaces)?.code;
  if (!code) return failure("Not online", 404);
  const { docs } = await payload.update({
    collection: "short-links",
    where: {
      and: [{ account: { equals: account.id } }, { code: { equals: code } }],
    },
    data: { shape },
    depth: 0,
    overrideAccess: true,
  });
  if (docs.length === 0) return failure("No short link", 404);

  // Every cookie on that short link goes – the new one has it now.
  const jar = all.filter(
    (other) => other.code !== code && other.hash !== cookie.hash
  );
  await keepJar(payload, account, [{ ...cookie, code }, ...jar]);
  return NextResponse.json({ code });
};

export const DELETE = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  const body = await bodyOf(request);
  if (typeof body.hash !== "string") return failure("Invalid hash", 400);
  const hash = currentForm(body.hash);
  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return failure("Not logged in", 401);

  const all = onlineJar(account);
  const leaving = all.find((cookie) => cookie.hash === hash);
  const jar = all.filter((cookie) => cookie.hash !== hash);
  if (leaving) await keepJar(payload, account, jar);
  const code = leaving?.code;
  if (code && !jar.some((cookie) => cookie.code === code)) {
    await payload.delete({
      collection: "short-links",
      where: {
        and: [{ account: { equals: account.id } }, { code: { equals: code } }],
      },
      overrideAccess: true,
    });
  }
  return NextResponse.json({ ok: true });
};
