import type { GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { FILAMENTS } from "../filaments";
import { GREETING_LIMITS, MAKERWORLD_GREETING } from "../greeting";

/** A color as #rrggbb. */
const hexColor = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? true
    : "A color as #rrggbb";

/** A creation's link – with its drawing, or a short link's code. */
const creationLink = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "A creation's link";
  try {
    const query = new URLSearchParams(
      new URL(value.trim()).hash.replace(/^#/, "")
    );
    return query.has("s") || query.has("k")
      ? true
      : "This link has no drawing – copy it from “Share creation” or the address bar.";
  } catch {
    return "That is not a link.";
  }
};

/**
 * Kits for MakerWorld, kept to download again: one cutter – what the
 * editor's MakerWorld button makes – or several, a set: one 3MF with all of
 * them on the plate, the pictures with all of them together, the texts with
 * each one's links, Blender photos of all together and of each. Built and
 * zipped right here in the admin (fields/makerworld-kit.tsx) – nothing of
 * it reaches the site but each cutter's short link, the kits' own (Short
 * links: named, with a picture, kept for good), which the texts link to.
 */
export const MakerWorld: GlobalConfig = {
  slug: "makerworld",
  label: "MakerWorld",
  access: { read: authenticated, update: authenticated },
  admin: {
    group: "Content",
    description:
      "Kits for MakerWorld: one cutter, or several as a set – one 3MF with all of them on the plate, the pictures with all of them together, the texts with each one's links. “Download kit” builds the zip right here, from what is in the form; save to keep a kit. Each cutter gets a short link (under Short links, with its picture and the kit's name) – the texts use those.",
  },
  fields: [
    {
      name: "kits",
      type: "array",
      labels: { singular: "Kit", plural: "Kits" },
      admin: {
        components: { RowLabel: "@/fields/makerworld-kit#KitRowLabel" },
      },
      fields: [
        {
          name: "name",
          type: "text",
          admin: {
            description:
              "A set's name, e.g. “Halloween” – for one cutter, empty: the cutter's own.",
          },
        },
        {
          name: "color",
          type: "text",
          label: "Color",
          required: true,
          defaultValue: FILAMENTS[1],
          admin: {
            description: "The 3MF's filament and the pictures' color.",
            components: { Field: "@/fields/makerworld-kit#FilamentField" },
          },
          validate: hexColor,
        },
        {
          name: "message",
          type: "text",
          label: "Greeting card text",
          required: true,
          defaultValue: MAKERWORLD_GREETING.message,
          maxLength: GREETING_LIMITS.message,
          admin: {
            description:
              "The test card's message: around the card in the pictures, and in each cutter's card link.",
          },
        },
        {
          name: "cutters",
          type: "array",
          labels: { singular: "Cutter", plural: "Cutters" },
          minRows: 1,
          required: true,
          admin: {
            description:
              "The creations' links – from “Share creation” or the address bar. In this order on the plate and in the texts.",
            components: { RowLabel: "@/fields/makerworld-kit#CutterRowLabel" },
          },
          fields: [
            {
              name: "link",
              type: "text",
              required: true,
              validate: creationLink,
            },
          ],
        },
        {
          name: "download",
          type: "ui",
          admin: {
            components: { Field: "@/fields/makerworld-kit#KitDownload" },
          },
        },
      ],
    },
  ],
};
