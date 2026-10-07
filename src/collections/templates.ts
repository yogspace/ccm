import path from "node:path";
import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import { MEDIA_DIR } from "../media";

/**
 * The templates next to the drawing area (star, circle …): an SVG each,
 * filled or drawn as a line – its outline is inserted. The order in the
 * editor is the order here (drag & drop in the list).
 *
 * Only the admin uploads them – an SVG may carry scripts, but the editor
 * only ever draws it as a picture (presets.ts).
 */
export const Templates: CollectionConfig = {
  slug: "templates",
  labels: { singular: "Template", plural: "Templates" },
  orderable: true,
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    description:
      "SVG templates next to the drawing area, in this order (drag & drop). Name them in both languages (locale at the top).",
    useAsTitle: "name",
    defaultColumns: ["name", "filename", "updatedAt"],
  },
  hooks: expireOnChange(TAGS.templates),
  upload: {
    staticDir: path.join(MEDIA_DIR, "templates"),
    mimeTypes: ["image/svg+xml"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
      admin: { description: "Shown on hover and read out: “Insert Star”." },
    },
  ],
};
