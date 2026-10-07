import path from "node:path";
import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import { MEDIA_DIR } from "../media";

/**
 * Pictures for the fan above the footer (gallery-fan.tsx): five of them,
 * drawn at random on every load. Square ones fit best – e.g. the white card
 * cut out of a “Share creation” picture. The order (drag & drop in the list)
 * only matters for the admin.
 *
 * Every picture gets a `card` size (480 px, WebP) – the fan shows that one.
 */
export const Gallery: CollectionConfig = {
  slug: "gallery",
  labels: { singular: "Picture", plural: "Gallery" },
  orderable: true,
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Content",
    description:
      "Pictures for the fan above the footer – five are drawn at random on every load. Square ones fit best.",
    defaultColumns: ["filename", "alt", "updatedAt"],
  },
  hooks: expireOnChange(TAGS.gallery),
  upload: {
    staticDir: path.join(MEDIA_DIR, "gallery"),
    mimeTypes: ["image/*"],
    adminThumbnail: "card",
    imageSizes: [
      {
        name: "card",
        width: 480,
        height: 480,
        position: "centre",
        formatOptions: { format: "webp", options: { quality: 82 } },
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      localized: true,
      admin: { description: "What the picture shows (optional)." },
    },
  ],
};
