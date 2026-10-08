import type { CollectionConfig, TextFieldSingleValidation } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";

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
 * the cutter from above on the card, its name. The picture comes from Media
 * (with its alt text): built from a creation's link above the list
 * (fields/gallery-builder.tsx) – the cutter from above, rendered in the
 * admin – or any picture there; one on a white ground lies on the card the
 * same way. The order (drag & drop in the list) only matters for the admin.
 */
export const Gallery: CollectionConfig = {
  slug: "gallery",
  labels: { singular: "Card", plural: "Gallery" },
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
    useAsTitle: "name",
    defaultColumns: ["name", "picture", "color", "link", "updatedAt"],
    components: {
      beforeListTable: ["@/fields/gallery-builder#GalleryBuilder"],
    },
  },
  hooks: expireOnChange(TAGS.gallery),
  fields: [
    {
      name: "picture",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description:
          "The cutter from above on the card – its alt text comes from Media.",
      },
    },
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
        description:
          "The creation the card was built from – empty for a picture picked by hand.",
      },
    },
  ],
};
