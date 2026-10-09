import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";

/**
 * Short links, made when a cookie goes online (account/client.ts): the model
 * of a creation, stood in for in links by its code (`#…&k=<code>` instead
 * of `&s=…`); the rest of the link – name, size, for whom, the message –
 * never comes here. The page fetches the model by its code
 * (app/(frontend)/next/shape/[code]/route.ts). They go when the cookie is
 * taken back, or with their account.
 */
export const ShortLinks: CollectionConfig = {
  slug: "short-links",
  labels: { singular: "Short link", plural: "Short links" },
  access: {
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: authenticated,
  },
  admin: {
    group: "Accounts",
    useAsTitle: "code",
    defaultColumns: ["code", "account", "createdAt"],
    description:
      "The models behind short links (…&k=<code> in a link) – made when a visitor puts a cookie online, gone when it is taken back or with the account. Only the model: names and messages stay in the links.",
  },
  fields: [
    {
      name: "code",
      type: "text",
      required: true,
      unique: true,
      index: true,
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
      admin: { readOnly: true, hidden: true },
    },
    {
      name: "account",
      type: "relationship",
      relationTo: "accounts",
      required: true,
      index: true,
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
};
