import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  currentAccount,
  failure,
  fromThisSite,
  getAccountsPayload,
} from "@/account/server";
import { PREVIEW_SIZE } from "@/export/preview-size";
import { clientIp, rateLimit } from "@/stats/rate-limit";

/**
 * A short link's picture from the visitor's own browser (account/preview.ts):
 * the server has no 3D, so the browser that put the cookie online draws its
 * cutter and sends it here – before, a picture only came when the admin
 * opened the link. Narrow on purpose: only for a short link of the logged-in
 * account, only while it has no picture, only a PNG of exactly the preview's
 * size. Like every preview, for the admin only (short-link-previews.ts).
 */
export const dynamic = "force-dynamic";

// A cookie goes online now and then – far more than this is abuse.
const tooMany = rateLimit({ limit: 30, windowMs: 60 * 60 * 1000 });

/** A preview is about 100–400 KB; more is not one of ours. */
const MAX_BYTES = 3 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's header – null if it isn't a PNG. */
const pngSize = (bytes: Uint8Array) => {
  if (bytes.length < 24) return null;
  if (PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

export const POST = async (request: NextRequest) => {
  if (!fromThisSite(request)) return failure("Forbidden", 403);
  if (tooMany(clientIp(request))) return failure("Too many requests", 429);

  const form = await request.formData().catch(() => null);
  const code = form?.get("code");
  const file = form?.get("file");
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(code)) {
    return failure("Invalid code", 400);
  }
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES) {
    return failure("Invalid picture", 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = pngSize(bytes);
  if (
    !size ||
    size.width !== PREVIEW_SIZE.width ||
    size.height !== PREVIEW_SIZE.height
  ) {
    return failure("Invalid picture", 400);
  }

  const payload = await getAccountsPayload();
  const account = await currentAccount(request, payload);
  if (!account) return failure("Not logged in", 401);

  const { docs } = await payload.find({
    collection: "short-links",
    where: {
      and: [{ account: { equals: account.id } }, { code: { equals: code } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const link = docs[0];
  if (!link) return failure("No short link", 404);
  // Drawn already – by another device or the admin. Nothing to do.
  if (link.preview) return NextResponse.json({ ok: true });

  const preview = await payload.create({
    collection: "short-link-previews",
    data: {},
    file: {
      data: Buffer.from(bytes),
      mimetype: "image/png",
      name: `cookie-${code}.png`,
      size: bytes.length,
    },
    depth: 0,
    overrideAccess: true,
  });
  await payload.update({
    collection: "short-links",
    id: link.id,
    data: { preview: preview.id },
    depth: 0,
    overrideAccess: true,
  });
  return NextResponse.json({ ok: true });
};
