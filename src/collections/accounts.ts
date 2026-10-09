import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { keyOf, newPassphrase } from "../account/keys";
import { EMPTY_DAYS, IDLE_DAYS } from "../account/rules";

/**
 * Visitors' accounts (account/server.ts) – no name, no email: a passphrase
 * only, kept as its key. They keep the cookies put online, each with a short
 * link. Made on the site, never here; the admin sees when each was made and
 * last visited and how many cookies it keeps online, finds one by its
 * passphrase (nothing kept), labels it to find it again, can keep it forever
 * (no deleting when idle) – label and keeping the only things to change
 * here – and can delete it; its short links go along. A kept one – your
 * own – can get a new passphrase here, which is then kept with it to look
 * up; no other account ever has its passphrase stored.
 */
export const Accounts: CollectionConfig = {
  slug: "accounts",
  labels: { singular: "Account", plural: "Accounts" },
  access: {
    read: authenticated,
    create: () => false,
    // Only label and “keep forever” – every other field refuses changes.
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    // Labelled ones by their label, the others by their id.
    useAsTitle: "label",
    listSearchableFields: ["label"],
    defaultColumns: [
      "label",
      "cookies",
      "lastSeenAt",
      "lastLoginAt",
      "keep",
      "createdAt",
    ],
    // Above the list: find an account by its passphrase.
    components: {
      beforeListTable: ["@/fields/account-finder#AccountFinder"],
    },
    description: `Visitors' accounts – no names, no email, a passphrase only (stored as a key, never readable). They keep the cookies their owners put online, each with a short link. Gone after ${IDLE_DAYS} days without a visit (after ${EMPTY_DAYS} if they never kept anything) unless kept forever – or when deleted here or in the account.`,
  },
  fields: [
    {
      // The admin's own note on an account – never sent to the site.
      name: "label",
      type: "text",
      label: "Label",
      admin: {
        description: "Only for you, to find it again. Visitors never see it.",
      },
    },
    {
      // scrypt of the passphrase – what a login finds the account by.
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { read: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: "lastSeenAt",
      type: "date",
      label: "Last visit",
      required: true,
      index: true,
      access: { update: () => false },
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      // Set when made, and at every login with the passphrase.
      name: "lastLoginAt",
      type: "date",
      label: "Last login",
      access: { update: () => false },
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      // The cookies put online, as the browser keeps them (cookie-jar.ts),
      // each with its short link's code.
      name: "jar",
      type: "json",
      access: { update: () => false },
      admin: { hidden: true },
    },
    {
      name: "cookies",
      type: "number",
      label: "Cookies",
      defaultValue: 0,
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      // Its short links, listed from their side – nothing stored here.
      name: "shortLinks",
      type: "join",
      label: "Short links",
      collection: "short-links",
      on: "account",
      admin: { defaultColumns: ["code", "createdAt"] },
    },
    {
      // Set here only: never deleted for being idle or empty (prune.ts).
      name: "keep",
      type: "checkbox",
      label: "Keep forever",
      defaultValue: false,
      index: true,
      admin: {
        position: "sidebar",
        description: `Never deleted automatically – not after ${IDLE_DAYS} days without a visit, nor when empty. Deleting it here or in the account still works.`,
      },
    },
    {
      // Kept only for accounts kept forever, set only by “New passphrase”
      // (the hook below guards it) – no other passphrase is ever stored.
      name: "passphrase",
      type: "text",
      label: "Passphrase",
      admin: {
        position: "sidebar",
        readOnly: true,
        condition: (data) => Boolean(data?.keep),
        description:
          "Kept accounts only – set with “New passphrase”. The old one stops working then.",
      },
    },
    {
      name: "newPassphrase",
      type: "ui",
      admin: {
        position: "sidebar",
        condition: (data) => Boolean(data?.keep),
        components: {
          Field: "@/fields/new-passphrase#NewPassphrase",
        },
      },
    },
  ],
  endpoints: [
    {
      // “New passphrase” (fields/new-passphrase.tsx): for an account kept
      // forever – your own – a fresh passphrase, kept with it to look up.
      path: "/:id/passphrase",
      method: "post",
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const id = String(req.routeParams?.id ?? "");
        const account = await req.payload
          .findByID({
            collection: "accounts",
            id,
            depth: 0,
            overrideAccess: true,
          })
          .catch(() => null);
        if (!account) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        if (!account.keep) {
          return Response.json(
            { error: "Kept accounts only" },
            { status: 400 }
          );
        }
        // Two alike are next to impossible – but then, another one.
        for (let attempt = 0; attempt < 3; attempt++) {
          const passphrase = newPassphrase("de");
          const key = await keyOf(passphrase);
          const { totalDocs } = await req.payload.count({
            collection: "accounts",
            where: { key: { equals: key } },
            overrideAccess: true,
          });
          if (totalDocs > 0) continue;
          await req.payload.update({
            collection: "accounts",
            id,
            data: { key, passphrase },
            depth: 0,
            overrideAccess: true,
            context: { newPassphrase: true },
          });
          return Response.json({ passphrase });
        }
        return Response.json({ error: "No passphrase found" }, { status: 500 });
      },
    },
    {
      // The admin's search (fields/account-finder.tsx): the account a
      // passphrase belongs to – its key computed, nothing kept.
      path: "/find",
      method: "post",
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json?.().catch(() => null);
        const phrase =
          typeof body?.passphrase === "string" ? body.passphrase : "";
        if (!phrase.trim() || phrase.length > 300) {
          return Response.json({ error: "No passphrase" }, { status: 400 });
        }
        const { docs } = await req.payload.find({
          collection: "accounts",
          where: { key: { equals: await keyOf(phrase) } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        return docs[0]
          ? Response.json({ id: docs[0].id })
          : Response.json({ error: "Not found" }, { status: 404 });
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, req }) => {
        // The passphrase changes only through “New passphrase”, and goes as
        // soon as the account is no longer kept.
        if (!req.context?.newPassphrase) {
          data.passphrase = originalDoc?.passphrase ?? null;
        }
        if (!(data.keep ?? originalDoc?.keep)) data.passphrase = null;
        return data;
      },
    ],
    afterDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: "short-links",
          where: { account: { equals: id } },
          overrideAccess: true,
          req,
        });
      },
    ],
  },
  timestamps: true,
};
