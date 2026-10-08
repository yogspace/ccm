import type { Field, GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import {
  SITE_DEFAULTS,
  SITE_LINK_LABELS,
  type SiteLinks,
} from "../site-defaults";

const link = (name: keyof SiteLinks, description: string): Field => ({
  name,
  type: "text",
  label: SITE_LINK_LABELS[name],
  required: true,
  defaultValue: SITE_DEFAULTS.links[name],
  admin: { description },
  validate: (value: unknown) =>
    typeof value === "string" && /^https:\/\/\S+$/.test(value)
      ? true
      : "A full address starting with https://",
});

/**
 * What the pages link to, and the owner's address – in one place. The links
 * show in the footer, on the card and in the legal text (inline “Site link”);
 * the address wherever the legal text has an “Address” block.
 */
export const Site: GlobalConfig = {
  slug: "site",
  label: "Site",
  access: { read: () => true, update: authenticated },
  hooks: expireOnChange(TAGS.site),
  admin: {
    group: "Settings",
    description:
      "Links in the footer, on the greeting card and in the legal text, the address in the legal text, and the greeting cards' favourite colours.",
  },
  fields: [
    {
      name: "links",
      type: "group",
      fields: [
        link(
          "website",
          "The footer's “mxwr.de” and the card's “made by”. Keep the utm part – it shows where visits came from."
        ),
        link("makerworld", "The footer's “MakerWorld”."),
        link("donate", "The sun cookie and “Buy me a cookie”."),
        link("source", "Where the source code is."),
      ],
    },
    {
      name: "address",
      type: "group",
      admin: {
        description:
          "Shown wherever the legal text has an “Address” block (§ 5 DDG, § 18 MStV).",
      },
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          defaultValue: SITE_DEFAULTS.address.name,
        },
        {
          name: "street",
          type: "text",
          required: true,
          defaultValue: SITE_DEFAULTS.address.street,
        },
        {
          name: "city",
          type: "text",
          label: "Postcode and city",
          required: true,
          defaultValue: SITE_DEFAULTS.address.city,
        },
        {
          name: "country",
          type: "text",
          required: true,
          defaultValue: SITE_DEFAULTS.address.country,
        },
      ],
    },
    {
      name: "cardColors",
      type: "array",
      label: "Card colours",
      labels: { singular: "Colour", plural: "Colours" },
      minRows: 1,
      admin: {
        description:
          "The favourite colours to pick for a greeting card – the cookie's icing, and in its shades the card, its back and its words. The first one is the default. A colour's place is its number in card links: add new ones at the end only, don't reorder or delete – sent cards would change colour.",
        initCollapsed: true,
      },
      fields: [
        {
          name: "color",
          type: "text",
          label: "Colour",
          required: true,
          admin: { description: "As #rrggbb, e.g. #ff5fa8." },
          validate: (value: unknown) =>
            typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
              ? true
              : "A colour as #rrggbb",
        },
        {
          name: "name",
          type: "text",
          required: true,
          localized: true,
          admin: { description: "Shown when pointing at it, read out aloud." },
        },
      ],
    },
  ],
};
