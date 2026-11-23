import { existsSync } from "node:fs";
import type { Payload } from "payload";
import type { Browser } from "puppeteer-core";
import type { DrawPreview } from "@/app/(render)/next/render/preview/preview-renderer";
import { wholeCreationOf } from "../collections/short-links";
import { FILAMENTS } from "../filaments";
import { PREVIEW_SIZE } from "./preview-size";

/** A picture without a kit: the kits' usual color – as the admin draws it. */
const PREVIEW_COLOR = FILAMENTS[1];

/**
 * A short link's picture, drawn on the server: a headless Chromium opens
 * the site's own render page (app/(render)/next/render/preview), builds the
 * cutter there exactly as the admin's browser does and hands back the PNG.
 * For every new short link (collections/short-links.ts, afterChange) and
 * the admin's “Create preview” button.
 *
 * One job at a time, Chromium started per job and closed after – it is
 * needed now and then and should not hold memory in between (the container
 * has 1 GB, docker-compose.yml). No sharp here: Payload makes the thumbnail
 * when the upload is created, as for every upload.
 */

/** The site as the server reaches itself – inside the container, not the proxy. */
const ORIGIN =
  process.env.PREVIEW_ORIGIN ??
  `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

/** Long enough for a large drawing in software WebGL; a hang ends here. */
const JOB_TIMEOUT = 90_000;

const findChromium = () => {
  const candidates = [
    process.env.CHROMIUM_PATH,
    // Alpine in the container.
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    // macOS, for development.
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter((path): path is string => Boolean(path));
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No Chromium found (${candidates.join(", ")}) – set CHROMIUM_PATH.`
    );
  }
  return found;
};

const launch = async (): Promise<Browser> => {
  const puppeteer = await import("puppeteer-core");
  return puppeteer.launch({
    executablePath: findChromium(),
    protocolTimeout: JOB_TIMEOUT,
    args: [
      // No user namespaces in the container; it only opens the own site.
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // Docker gives /dev/shm only 64 MB.
      "--disable-dev-shm-usage",
      // WebGL without a GPU in the container: Mesa's llvmpipe on the CPU
      // through EGL (Dockerfile) – Alpine's Chromium has no SwiftShader. A
      // Mac's Chrome has WebGL as it is.
      ...(process.platform === "linux"
        ? ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"]
        : []),
    ],
  });
};

/** A PNG's width and height from its header – null if it isn't one. */
const pngSize = (bytes: Buffer) =>
  bytes.length >= 24 &&
  bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    : null;

/** The picture of a creation (a link with its model in it), as PNG. */
const draw = async (creation: string, color: string) => {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${ORIGIN}/next/render/preview`, {
      waitUntil: "load",
      timeout: JOB_TIMEOUT,
    });
    await page.waitForFunction(() => Boolean(window.ccmDrawPreview), {
      timeout: 30_000,
    });
    const base64 = await page.evaluate(
      (creation, color) =>
        (window.ccmDrawPreview as DrawPreview)(creation, color),
      creation,
      color
    );
    if (!base64) throw new Error("No cutter came out of it.");
    const png = Buffer.from(base64, "base64");
    const size = pngSize(png);
    if (
      size?.width !== PREVIEW_SIZE.width ||
      size.height !== PREVIEW_SIZE.height
    ) {
      throw new Error("The picture has the wrong size.");
    }
    return png;
  } finally {
    await browser.close().catch(() => undefined);
  }
};

const withTimeout = <T>(task: Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Preview timed out.")),
      JOB_TIMEOUT + 10_000
    );
    task.then(resolve, reject).finally(() => clearTimeout(timer));
  });

// One after the other – several Chromiums at once would not fit.
let chain: Promise<unknown> = Promise.resolve();
// A short link queued already is not queued twice.
const pending = new Map<string, Promise<boolean>>();

/**
 * Draws a short link's picture and keeps it – false if it has one already
 * (`force` draws it anew). Throws if it could not be drawn.
 */
const run = async (payload: Payload, id: string, force: boolean) => {
  const link = await payload.findByID({
    collection: "short-links",
    id,
    depth: 0,
    overrideAccess: true,
  });
  if (link.preview && !force) return false;
  const shape = link.shape;
  const png = await draw(
    await wholeCreationOf(payload, link),
    link.color ?? PREVIEW_COLOR
  );

  // Changed meanwhile (another version, a picture from the admin's
  // browser): this one is not wanted any more.
  const now = await payload
    .findByID({
      collection: "short-links",
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!now || now.shape !== shape || (now.preview && !force)) return false;

  const preview = await payload.create({
    collection: "short-link-previews",
    data: {},
    file: {
      data: png,
      mimetype: "image/png",
      name: `cookie-${link.code}.png`,
      size: png.length,
    },
    depth: 0,
    overrideAccess: true,
  });
  // The old picture goes with the change (short-links.ts, afterChange).
  await payload.update({
    collection: "short-links",
    id,
    data: { preview: preview.id },
    depth: 0,
    overrideAccess: true,
  });
  return true;
};

/** Queues the picture of short link `id`; resolves when it is done. */
export const createPreview = (
  payload: Payload,
  id: string,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> => {
  const queued = pending.get(id);
  if (queued && !force) return queued;
  const job = chain
    .catch(() => undefined)
    .then(() => withTimeout(run(payload, id, force)))
    .finally(() => pending.delete(id));
  chain = job.catch(() => undefined);
  pending.set(id, job);
  return job;
};

/** The same in the background – a failure is logged, the admin can retry. */
export const queuePreview = (payload: Payload, id: string) => {
  createPreview(payload, id).catch((error) => {
    payload.logger.warn(
      `Short link preview ${id} failed: ${error instanceof Error ? error.message : String(error)}`
    );
  });
};
