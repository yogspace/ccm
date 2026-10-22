import type { CollectionConfig, Payload } from "payload";
import { authenticated } from "../access/authenticated";
import { newCode } from "../account/keys";
import { isCode, isSavedCookie, isShape, modelOf } from "../account/rules";
import { FILAMENTS } from "../filaments";
import { MAKERWORLD_GREETING } from "../greeting";
import { currentForm } from "../link-keys";
import type { ShortLink } from "../payload-types";
import { SITE } from "../seo";

/** A creation's hash with its model stood in for by `code`. */
const shortHash = (hash: string, code: string) => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  query.delete("s");
  query.set("k", code);
  return `#${query}`;
};

/** A relationship's or upload's id – populated or not. */
const idOf = (value: unknown) =>
  value && typeof value === "object" && "id" in value
    ? String(value.id)
    : typeof value === "string"
      ? value
      : null;

/**
 * A short link's creation, whole: one made here as it was made or
 * downloaded last, a visitor's as their online cookie has it – else the
 * model alone.
 */
const creationOf = async (payload: Payload, link: ShortLink) => {
  if (link.link) return `${SITE}/${link.link}`;
  const account = idOf(link.account);
  if (account) {
    const found = await payload
      .findByID({
        collection: "accounts",
        id: account,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    const cookie = (Array.isArray(found?.jar) ? found.jar : [])
      .filter(isSavedCookie)
      .find(({ code }) => code === link.code);
    if (cookie) return `${SITE}/${currentForm(cookie.hash)}`;
  }
  return `${SITE}/#k=${link.code}`;
};

/** The same, its model in it (`s`) – nothing to fetch to build it. */
const wholeCreationOf = async (payload: Payload, link: ShortLink) => {
  const url = new URL(await creationOf(payload, link));
  const query = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (!query.has("s")) {
    query.delete("k");
    query.set("s", link.shape);
  }
  return `${url.origin}${url.pathname}#${query}`;
};

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });

/**
 * Short links: the model of a creation, stood in for in links by its code
 * (`#…&k=<code>` instead of `&s=…`). The page fetches the model by its code
 * (app/(frontend)/next/shape/[code]/route.ts). Made when a visitor puts a
 * cookie online (account/client.ts) – the rest of the link (name, size, for
 * whom, the message) never comes here – and gone when it is taken back or
 * with their account. Or made here, without an account and kept for good:
 * for each cutter of a MakerWorld kit (fields/makerworld-kit.tsx) – named
 * after kit and cutter, the kit's texts link to it – or from a link above
 * the list (fields/short-links-tools.tsx); the whole creation kept. Each
 * can have a picture of its cutter, for the admin only
 * (short-link-previews.ts) – the Seeds page renders them all. Ticked in the
 * list, short links become a new kit.
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
      "The models behind short links (…&k=<code> in a link) – made when a visitor puts a cookie online, gone when it is taken back or with the account. Only the model: names and messages stay in the links. Those without an account are made here – by MakerWorld kits or from a link above – and kept until deleted. Tick some to make a MakerWorld kit of them; Seeds renders the pictures.",
    // Above the list: a short link from a link, the ticked ones as a kit.
    components: {
      beforeListTable: ["@/fields/short-links-tools#ShortLinksTools"],
    },
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
        description: "None: made here – for a MakerWorld kit or from a link.",
      },
    },
    {
      // Made here: the kit's and the cutter's name (“Halloween – Pumpkin”),
      // or the creation's own – visitors' have none.
      name: "name",
      type: "text",
      label: "Name",
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      // Made here: the creation as linked to last (`#n=…&k=…`) – name, size
      // and the rest, what a kit made of it again takes.
      name: "link",
      type: "text",
      access: { update: () => false },
      admin: { readOnly: true, hidden: true },
    },
    {
      // A kit's: its color (#rrggbb) – the picture's, drawn again.
      name: "color",
      type: "text",
      access: { update: () => false },
      admin: { readOnly: true, hidden: true },
    },
    {
      // Its cutter, for the admin only – a new one replaces the old.
      name: "preview",
      type: "upload",
      relationTo: "short-link-previews",
      label: "Preview",
      admin: { readOnly: true },
    },
  ],
  endpoints: [
    {
      // A creation (`hash`) of a MakerWorld kit (fields/makerworld-kit.tsx)
      // or given above the list: the short link for its model – the
      // admin's own, one per model, made once – named, linked and colored
      // as it was given last.
      path: "/kit",
      method: "post",
      handler: async (req) => {
        if (!req.user) return unauthorized();
        const body = await req.json?.().catch(() => null);
        const hash =
          typeof body?.hash === "string" && body.hash.length <= 17000
            ? currentForm(body.hash)
            : "";
        const shape = modelOf(hash);
        if (!isShape(shape)) {
          return Response.json({ error: "Invalid shape" }, { status: 400 });
        }
        const name =
          typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
        const color =
          typeof body?.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)
            ? body.color
            : null;
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
        if (link) {
          const data = {
            name: name || link.name,
            link: shortHash(hash, link.code),
            color: color ?? link.color,
          };
          if (
            data.name !== link.name ||
            data.link !== link.link ||
            data.color !== link.color
          ) {
            link = await req.payload.update({
              collection: "short-links",
              id: link.id,
              data,
              depth: 0,
              overrideAccess: true,
            });
          }
        }
        // A code taken already (next to impossible): another one.
        for (let attempt = 0; !link && attempt < 3; attempt++) {
          const code = newCode();
          try {
            link = await req.payload.create({
              collection: "short-links",
              data: {
                code,
                shape,
                name: name || null,
                link: shortHash(hash, code),
                color,
              },
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
    {
      // Every short link – or those of `codes` – with its creation, whole,
      // and the color to draw it in: for the Seeds page's pictures
      // (admin/previews-runner.tsx) and a code typed above the list.
      path: "/previews",
      method: "post",
      handler: async (req) => {
        if (!req.user) return unauthorized();
        const body = await req.json?.().catch(() => null);
        const codes: string[] | null = Array.isArray(body?.codes)
          ? body.codes.filter(isCode)
          : null;
        const { docs } = await req.payload.find({
          collection: "short-links",
          where: codes ? { code: { in: codes } } : undefined,
          pagination: false,
          depth: 0,
          overrideAccess: true,
          sort: "createdAt",
        });
        const links = [];
        for (const link of docs) {
          links.push({
            id: link.id,
            code: link.code,
            creation: await wholeCreationOf(req.payload, link),
            color: link.color ?? null,
            preview: Boolean(link.preview),
          });
        }
        return Response.json({ links });
      },
    },
    {
      // “Make a MakerWorld kit” above the list (fields/short-links-tools.tsx):
      // the ticked short links, in the list's order, as a new kit – first
      // among the kits, in the usual color and with the usual card text.
      path: "/set",
      method: "post",
      handler: async (req) => {
        if (!req.user) return unauthorized();
        const body = await req.json?.().catch(() => null);
        const ids: string[] = Array.isArray(body?.ids)
          ? body.ids.filter((id: unknown) => typeof id === "string")
          : [];
        if (ids.length === 0 || ids.length > 100) {
          return Response.json({ error: "No short links" }, { status: 400 });
        }
        const { docs } = await req.payload.find({
          collection: "short-links",
          where: { id: { in: ids } },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        });
        const cutters = [];
        for (const id of ids) {
          const link = docs.find((doc) => doc.id === id);
          if (link) cutters.push({ link: await creationOf(req.payload, link) });
        }
        if (cutters.length === 0) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const { kits } = await req.payload.findGlobal({
          slug: "makerworld",
          depth: 0,
          overrideAccess: true,
        });
        await req.payload.updateGlobal({
          slug: "makerworld",
          data: {
            kits: [
              {
                color: FILAMENTS[1],
                message: MAKERWORLD_GREETING.message,
                cutters,
              },
              ...(kits ?? []),
            ],
          },
          depth: 0,
          overrideAccess: true,
        });
        return Response.json({ cutters: cutters.length });
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        // Switched to a new version (links/route.ts): its picture is the
        // old one's – gone, until drawn again.
        const keptPicture =
          data.preview === undefined ||
          idOf(data.preview) === idOf(originalDoc?.preview);
        if (data.shape && data.shape !== originalDoc?.shape && keptPicture) {
          data.preview = null;
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // A new picture: the old one goes.
        const before = idOf(previousDoc?.preview);
        if (!before || before === idOf(doc.preview)) return;
        await req.payload
          .delete({
            collection: "short-link-previews",
            id: before,
            overrideAccess: true,
            req,
          })
          .catch(() => undefined);
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        // Its picture goes along.
        const preview = idOf(doc.preview);
        if (!preview) return;
        await req.payload
          .delete({
            collection: "short-link-previews",
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
