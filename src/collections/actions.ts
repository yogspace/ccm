import type { CollectionConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { ACTION_NAMES } from "../stats/actions";

/**
 * What people do – one row per action (a download, a card created …), with
 * the page it happened on and the device class. Anonymous like the page
 * views (see there): no IP, no cookie, nothing linking two rows.
 *
 * Written only by /next/action (local API). Pruned with the page views.
 */
export const Actions: CollectionConfig = {
  slug: "actions",
  admin: {
    hidden: true,
    useAsTitle: "name",
    defaultColumns: ["name", "path", "device", "createdAt"],
  },
  access: {
    create: () => false,
    delete: authenticated,
    read: authenticated,
    update: () => false,
  },
  fields: [
    {
      name: "name",
      type: "select",
      required: true,
      index: true,
      options: [...ACTION_NAMES],
    },
    { name: "path", type: "text" },
    { name: "device", type: "text" },
  ],
};
