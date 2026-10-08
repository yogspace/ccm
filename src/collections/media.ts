import path from "node:path";
import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import { MEDIA_DIR } from "../media";

/**
 * All pictures, each with its alt text – what the gallery's cards show (and
 * whatever else needs a picture). The gallery builder adds its renderings
 * here too (fields/gallery-builder.tsx).
 *
 * Every picture gets a `card` size (WebP, the shape of the cutter's place on
 * the share picture) – the gallery's fan shows that one.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Picture", plural: "Media" },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Content",
    description: "All pictures, each with what it shows.",
    defaultColumns: ["filename", "alt", "updatedAt"],
  },
  // The gallery shows them – a new alt text or file shows right away.
  hooks: expireOnChange(TAGS.gallery),
  upload: {
    staticDir: path.join(MEDIA_DIR, "media"),
    mimeTypes: ["image/*"],
    adminThumbnail: "card",
    imageSizes: [
      {
        name: "card",
        width: 600,
        height: 489,
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
      admin: { description: "What the picture shows – read out instead." },
    },
  ],
};
