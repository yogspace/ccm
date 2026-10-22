import type { GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import {
  adminShortLinkFor,
  creationHashOf,
  wholeCreationOf,
} from "../collections/short-links";
import { FILAMENTS } from "../filaments";
import { GREETING_LIMITS, MAKERWORLD_GREETING } from "../greeting";
import type { Makerworld } from "../payload-types";
import { kitLinkName } from "../short-shape";

/** A color as #rrggbb. */
const hexColor = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? true
    : "A color as #rrggbb";

/** A creation's link – with its drawing, or a short link's code. */
const creationLink = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return "A short link or a creation's link";
  }
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
 * A cutter is picked from the short links, or given as a link.
 */
export const MakerWorld: GlobalConfig = {
  slug: "makerworld",
  label: "MakerWorld",
  access: { read: authenticated, update: authenticated },
  admin: {
    group: "Content",
    description:
      "Kits for MakerWorld: one cutter, or several as a set – one 3MF with all of them on the plate, the pictures with all of them together, the texts with each one's links. “Download kit” builds the zip right here, from what is in the form; save to keep a kit. Each cutter gets a short link once saved or downloaded – one per drawing, the editor's link and a card's alike (under Short links, with the kit's name; the picture comes with the download) – the texts use those.",
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
              "A short link each – or a creation's link, from “Share creation” or the address bar. In this order on the plate and in the texts.",
            components: { RowLabel: "@/fields/makerworld-kit#CutterRowLabel" },
          },
          fields: [
            {
              // The creation behind it, whole (collections/short-links.ts).
              name: "shortLink",
              type: "relationship",
              relationTo: "short-links",
              label: "Short link",
              admin: { appearance: "drawer", allowCreate: false },
            },
            {
              // Without a short link only – then required.
              name: "link",
              type: "text",
              label: "…or a link",
              admin: { condition: (_, sibling) => !sibling?.shortLink },
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
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        // Saved: every cutter has its short link – the admin's own for its
        // model, named after kit and cutter where it has no name yet (the
        // kit downloaded renames it). Its picture follows with the kit's
        // download, or on the Seeds page (only the browser draws).
        for (const kit of (doc as Makerworld).kits ?? []) {
          for (const cutter of kit.cutters ?? []) {
            try {
              const picked =
                cutter.shortLink && typeof cutter.shortLink === "object"
                  ? cutter.shortLink
                  : cutter.shortLink
                    ? await req.payload.findByID({
                        collection: "short-links",
                        id: cutter.shortLink,
                        depth: 0,
                        overrideAccess: true,
                      })
                    : null;
              const source = picked
                ? await wholeCreationOf(req.payload, picked)
                : cutter.link;
              const hash =
                source && (await creationHashOf(req.payload, source));
              if (!hash) continue;
              const name =
                new URLSearchParams(hash.slice(1)).get("n")?.trim() ||
                "Cookie Cutter";
              await adminShortLinkFor(req.payload, {
                hash,
                name: kitLinkName(kit.name ?? "", name),
                color: kit.color,
                fillOnly: true,
              });
            } catch {
              // A link that leads nowhere: the download says so.
            }
          }
        }
      },
    ],
  },
};
