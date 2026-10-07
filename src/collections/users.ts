import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";

/** The admin's login – nobody else has an account. */
export const Users: CollectionConfig = {
  slug: "users",
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ["name", "email"],
    useAsTitle: "email",
  },
  auth: true,
  fields: [{ name: "name", type: "text" }],
  timestamps: true,
};
