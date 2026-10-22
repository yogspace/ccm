import path from "node:path";
import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { MEDIA_DIR } from "../media";

/**
 * Short links' pictures (collections/short-links.ts): the cutter of each,
 * rendered in the admin's browser – by a kit's download, a short link made
 * above the list, or the Seeds page for all of them. For the admin only –
 * unlike Media, never public: a visitor's online cookie is theirs.
 */
export const ShortLinkPreviews: CollectionConfig = {
  slug: "short-link-previews",
  labels: { singular: "Short link preview", plural: "Short link previews" },
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    // Seen through their short links only.
    hidden: true,
  },
  upload: {
    staticDir: path.join(MEDIA_DIR, "short-link-previews"),
    // The picture a PNG, its thumbnail WebP – both have to be allowed.
    mimeTypes: ["image/png", "image/webp"],
    adminThumbnail: "thumbnail",
    imageSizes: [
      {
        // The short link's picture in the list – Media's card shape.
        name: "thumbnail",
        width: 300,
        height: 245,
        position: "centre",
        formatOptions: { format: "webp", options: { quality: 82 } },
      },
    ],
  },
  fields: [],
};
