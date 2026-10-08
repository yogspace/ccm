import path from "node:path";
import type { CollectionConfig, TextFieldSingleValidation } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import { MEDIA_DIR } from "../media";

/** Only the card colors set in Site – or none, then the first. */
const siteColor: TextFieldSingleValidation = async (value, { req }) => {
  if (!value) return true;
  const site = await req.payload.findGlobal({ slug: "site", depth: 0, req });
  const known = site.cardColors?.some(
    ({ color }) => color.toLowerCase() === value.toLowerCase()
  );
  return known ? true : "One of the card colors set in Site";
};

/**
 * Cards for the fan above the footer (gallery-fan.tsx): five of them, drawn
 * at random on every load, each shown like the share picture – its color,
 * the cutter from above on the card, its name. Built from a creation's link
 * above the list (fields/gallery-builder.tsx): the picture is the cutter
 * from above, rendered in the admin. Pictures uploaded by hand (white
 * ground) lie on the card the same way. The order (drag & drop in the list)
 * only matters for the admin.
 *
 * Every picture gets a `card` size (WebP, the shape of the cutter's place on
 * the share picture) – the fan shows that one.
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
      "Cards for the fan above the footer – five are drawn at random on every load. Paste a creation's link below to build one.",
    defaultColumns: ["filename", "name", "link", "updatedAt"],
    components: {
      beforeListTable: ["@/fields/gallery-builder#GalleryBuilder"],
    },
  },
  hooks: expireOnChange(TAGS.gallery),
  upload: {
    staticDir: path.join(MEDIA_DIR, "gallery"),
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
      name: "name",
      type: "text",
      admin: {
        description: "On the card below the cutter – empty: “Cookie Cutter”.",
      },
    },
    {
      name: "color",
      type: "text",
      admin: {
        description:
          "One of the card colors set in Site – none chosen: the first.",
        components: { Field: "@/fields/gallery-color-field#GalleryColorField" },
      },
      validate: siteColor,
    },
    {
      name: "link",
      type: "text",
      admin: {
        readOnly: true,
        description: "The creation the card was built from.",
      },
    },
    {
      name: "alt",
      type: "text",
      localized: true,
      admin: { description: "What the picture shows (optional)." },
    },
  ],
};
