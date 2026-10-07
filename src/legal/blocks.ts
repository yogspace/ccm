import type { Block } from "payload";
import { SITE_LINK_LABELS, type SiteLinks } from "../site-defaults";

/**
 * The legal text's own building blocks (globals/legal.ts, drawn by
 * legal/legal-content.tsx). They keep what belongs elsewhere out of the text:
 * the address and the links live in the “Site” global, the form is the form.
 */

/** The owner's address from the “Site” global – twice in the imprint, kept once. */
export const AddressBlock: Block = {
  slug: "address",
  labels: { singular: "Address", plural: "Addresses" },
  admin: {
    disableBlockName: true,
    components: { Block: "@/fields/legal-blocks#AddressBlockPreview" },
  },
  fields: [],
};

/** The contact form, where the block sits. */
export const ContactFormBlock: Block = {
  slug: "contactForm",
  labels: { singular: "Contact form", plural: "Contact forms" },
  admin: {
    disableBlockName: true,
    components: { Block: "@/fields/legal-blocks#ContactFormBlockPreview" },
  },
  fields: [],
};

/** A link inside a sentence to one of the site's links (“PayPal”, “GitHub”). */
export const SiteLinkBlock: Block = {
  slug: "siteLink",
  labels: { singular: "Site link", plural: "Site links" },
  admin: {
    disableBlockName: true,
    components: { Label: "@/fields/legal-blocks#SiteLinkLabel" },
  },
  fields: [
    {
      name: "link",
      type: "select",
      required: true,
      options: (Object.keys(SITE_LINK_LABELS) as (keyof SiteLinks)[]).map(
        (value) => ({ value, label: SITE_LINK_LABELS[value] })
      ),
    },
    {
      name: "label",
      type: "text",
      required: true,
      admin: { description: "The linked words, e.g. “PayPal”." },
    },
  ],
};

/** The date the legal text was last saved – “Stand: 7. Oktober 2026”. */
export const UpdatedBlock: Block = {
  slug: "updated",
  labels: { singular: "Last updated", plural: "Last updated" },
  admin: {
    disableBlockName: true,
    components: { Label: "@/fields/legal-blocks#UpdatedLabel" },
  },
  fields: [],
};
