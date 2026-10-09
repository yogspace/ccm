import type { Field, GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import {
  type CookieColors,
  SITE_DEFAULTS,
  SITE_LINK_LABELS,
  type SiteLinks,
} from "../site-defaults";

/** A color as #rrggbb. */
const hexColor = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? true
    : "A color as #rrggbb";

/** A cookie color: the hex field with a picker beside it. */
const cookieColor = (
  name: keyof CookieColors,
  label: string,
  description: string
): Field => ({
  name,
  type: "text",
  label,
  required: true,
  defaultValue: SITE_DEFAULTS.cookies[name],
  admin: {
    description,
    components: {
      Field: {
        path: "@/fields/card-color-field#ColorField",
        clientProps: {
          fallback: SITE_DEFAULTS.cookies[name],
          dough: name === "dough" ? "plain" : "chocolate",
        },
      },
    },
  },
  validate: hexColor,
});

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
      "Links in the footer, on the greeting card and in the legal text, the address in the legal text, the greeting cards' favorite colors, and the cookies' colors.",
  },
  fields: [
    {
      name: "links",
      type: "group",
      admin: { position: "sidebar" },
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
        position: "sidebar",
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
      label: "Card colors",
      labels: { singular: "Color", plural: "Colors" },
      minRows: 1,
      admin: {
        description:
          "The favorite colors to pick for a greeting card – the cookie's icing, and in its shades the card, its back and its words. The first one is the default. A color's place is its number in card links: add new ones at the end only, don't reorder or delete – sent cards would change color.",
        initCollapsed: true,
        components: {
          RowLabel: "@/fields/card-color-field#CardColorRowLabel",
        },
      },
      fields: [
        {
          name: "color",
          type: "text",
          label: "Color",
          required: true,
          admin: {
            description:
              "As #rrggbb, e.g. #ff5fa8 – or pick it. Below: the card in its shades.",
            components: {
              Field: "@/fields/card-color-field#CardColorField",
            },
          },
          validate: hexColor,
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
    {
      name: "cookies",
      type: "group",
      label: "Cookies",
      admin: {
        description:
          "The 3D cookies' colors everywhere on the site. Their sprinkles are the card colors and white – one too close to the icing it lies on turns a little lighter or darker.",
      },
      fields: [
        cookieColor(
          "dough",
          "Dough",
          "The cookies' dough – its specks and sheen follow it."
        ),
        cookieColor(
          "chocolate",
          "Chocolate",
          "The chocolate chips – and, in a lighter shade, the chocolate dough."
        ),
      ],
    },
  ],
};
