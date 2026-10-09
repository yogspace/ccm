import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { keyOf } from "../account/keys";
import { EMPTY_DAYS, IDLE_DAYS } from "../account/rules";

/**
 * Visitors' accounts (account/server.ts) – no name, no email: a passphrase
 * only, kept as its key. They keep the cookies put online, each with a short
 * link. Made on the site, never here; the admin sees when each was made and
 * last visited and how many cookies it keeps online, finds one by its
 * passphrase (nothing kept), can keep it forever
 * (no deleting when idle) – the only thing to change here – and can delete
 * it; its short links go along.
 */
export const Accounts: CollectionConfig = {
  slug: "accounts",
  labels: { singular: "Account", plural: "Accounts" },
  access: {
    read: authenticated,
    create: () => false,
    // Only “keep forever” – every other field refuses changes itself.
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    defaultColumns: ["id", "cookies", "lastSeenAt", "keep", "createdAt"],
    // Above the list: find an account by its passphrase.
    components: {
      beforeListTable: ["@/fields/account-finder#AccountFinder"],
    },
    description: `Visitors' accounts – no names, no email, a passphrase only (stored as a key, never readable). They keep the cookies their owners put online, each with a short link. Gone after ${IDLE_DAYS} days without a visit (after ${EMPTY_DAYS} if they never kept anything) unless kept forever – or when deleted here or in the account.`,
  },
  fields: [
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
  ],
  endpoints: [
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
