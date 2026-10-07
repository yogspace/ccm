import path from "node:path";

/**
 * Where uploads (gallery pictures, template SVGs) are kept: outside the image,
 * so they survive deploys – on the server the `media` volume (MEDIA_DIR=
 * /data/media), locally `media/` in the repo (ignored, filled by `pnpm
 * payload:media:sync`).
 */
export const MEDIA_DIR =
  process.env.MEDIA_DIR ?? path.resolve(process.cwd(), "media");
