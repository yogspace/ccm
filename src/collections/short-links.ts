import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { newCode } from "../account/keys";
import { isShape } from "../account/rules";

/**
 * Short links: the model of a creation, stood in for in links by its code
 * (`#…&k=<code>` instead of `&s=…`). The page fetches the model by its code
 * (app/(frontend)/next/shape/[code]/route.ts). Made when a visitor puts a
 * cookie online (account/client.ts) – the rest of the link (name, size, for
 * whom, the message) never comes here – and gone when it is taken back or
 * with their account. Or made here, for each cutter of a MakerWorld kit
 * (fields/makerworld-kit.tsx): no account, named after kit and cutter, a
 * picture of the cutter, kept for good – the kit's texts link to it.
 */
export const ShortLinks: CollectionConfig = {
  slug: "short-links",
  labels: { singular: "Short link", plural: "Short links" },
  access: {
    read: authenticated,
    create: () => false,
    // Only the preview – every other field refuses changes.
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    useAsTitle: "code",
    listSearchableFields: ["code", "name"],
    defaultColumns: ["preview", "name", "code", "account", "createdAt"],
    description:
      "The models behind short links (…&k=<code> in a link) – made when a visitor puts a cookie online, gone when it is taken back or with the account. Only the model: names and messages stay in the links. Those without an account come from MakerWorld kits: named after kit and cutter, with a picture of the cutter, kept until deleted here.",
  },
  fields: [
    {
      name: "code",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      // Its address on the site, to open.
      name: "open",
      type: "ui",
      admin: {
        components: { Field: "@/fields/short-link-open#ShortLinkOpen" },
      },
    },
    {
      // The model as links carry it (`s`, url-state.ts).
      name: "shape",
      type: "text",
      required: true,
      access: { update: () => false },
      admin: { readOnly: true, hidden: true },
    },
    {
      name: "account",
      type: "relationship",
      relationTo: "accounts",
      index: true,
      access: { update: () => false },
      admin: {
        readOnly: true,
        description: "None: made for a MakerWorld kit.",
      },
    },
    {
      // A kit's and its cutter's name (“Halloween – Pumpkin”), set by its
      // last download – visitors' have none.
      name: "name",
      type: "text",
      label: "Name",
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      // A kit's cutter as its pictures show it – visitors' have none.
      name: "preview",
      type: "upload",
      relationTo: "media",
      label: "Preview",
      admin: { readOnly: true },
    },
  ],
  endpoints: [
    {
      // A MakerWorld kit's cutter (fields/makerworld-kit.tsx): the short
      // link for its model – the kits' own, one per model, made once,
      // named as the kit downloaded last calls it.
      path: "/kit",
      method: "post",
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json?.().catch(() => null);
        const shape: unknown = body?.shape;
        if (!isShape(shape)) {
          return Response.json({ error: "Invalid shape" }, { status: 400 });
        }
        const name =
          typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
        const { docs } = await req.payload.find({
          collection: "short-links",
          where: {
            and: [{ shape: { equals: shape } }, { account: { exists: false } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        let link = docs[0];
        if (link && name && link.name !== name) {
          link = await req.payload.update({
            collection: "short-links",
            id: link.id,
            data: { name },
            depth: 0,
            overrideAccess: true,
          });
        }
        // A code taken already (next to impossible): another one.
        for (let attempt = 0; !link && attempt < 3; attempt++) {
          try {
            link = await req.payload.create({
              collection: "short-links",
              data: { code: newCode(), shape, name: name || null },
              depth: 0,
              overrideAccess: true,
            });
          } catch {
            // The unique index said no – try again.
          }
        }
        if (!link) {
          return Response.json({ error: "No code found" }, { status: 500 });
        }
        return Response.json({
          id: link.id,
          code: link.code,
          preview: Boolean(link.preview),
        });
      },
    },
  ],
  hooks: {
    afterDelete: [
      async ({ doc, req }) => {
        // Its picture goes along.
        const preview =
          typeof doc.preview === "object" ? doc.preview?.id : doc.preview;
        if (!preview) return;
        await req.payload
          .delete({
            collection: "media",
            id: preview,
            overrideAccess: true,
            req,
          })
          .catch(() => undefined);
      },
    ],
  },
  timestamps: true,
};
