import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { EMPTY_DAYS, IDLE_DAYS } from "../account/rules";

/**
 * Visitors' accounts (account/server.ts) – no name, no email: a passphrase
 * only, kept as its key. They keep the cookies put online, each with a short
 * link. Made on the site, never here; the admin sees when each was made and
 * last visited and how many cookies it keeps online, and can delete it – its
 * short links go along.
 */
export const Accounts: CollectionConfig = {
  slug: "accounts",
  labels: { singular: "Account", plural: "Accounts" },
  access: {
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    defaultColumns: ["id", "cookies", "lastSeenAt", "createdAt"],
    description: `Visitors' accounts – no names, no email, a passphrase only (stored as a key, never readable). They keep the cookies their owners put online, each with a short link. Gone after ${IDLE_DAYS} days without a visit (after ${EMPTY_DAYS} if they never kept anything) – or when deleted here or in the account.`,
  },
  fields: [
    {
      // scrypt of the passphrase – what a login finds the account by.
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { read: () => false },
      admin: { hidden: true },
    },
    {
      name: "lastSeenAt",
      type: "date",
      label: "Last visit",
      required: true,
      index: true,
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
      admin: { hidden: true },
    },
    {
      name: "cookies",
      type: "number",
      label: "Cookies",
      defaultValue: 0,
      admin: { readOnly: true },
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
