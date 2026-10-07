import {
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  lexicalEditor,
  OrderedListFeature,
  ParagraphFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical";
import type { GlobalConfig } from "payload";
import { authenticated } from "../access/authenticated";
import { expireOnChange, TAGS } from "../cache";
import {
  AddressBlock,
  ContactFormBlock,
  SiteLinkBlock,
  UpdatedBlock,
} from "../legal/blocks";

/**
 * Imprint and privacy notice – the dialog behind “Imprint & privacy” in the
 * footer, in German and English (locale at the top of the admin).
 *
 * The editor has what the dialog draws and nothing else, so the text can't
 * look any different from the rest of the page: big headings (h2) for the
 * parts, small ones (h3) for the sections, paragraphs, bold and italic,
 * lists and links. Plus the blocks of legal/blocks.ts – the address and the
 * links come from the “Site” global, the contact form is the real form, and
 * “Last updated” keeps the date by itself.
 */
export const Legal: GlobalConfig = {
  slug: "legal",
  label: "Imprint & privacy",
  access: { read: () => true, update: authenticated },
  hooks: expireOnChange(TAGS.legal),
  admin: {
    description:
      "The dialog behind “Imprint & privacy”. Address and links come from “Site”; switch the language at the top.",
  },
  fields: [
    {
      name: "content",
      type: "richText",
      localized: true,
      required: true,
      // Looks like the dialog (custom.scss): Pally, the same sizes and colours.
      admin: { className: "legal-editor" },
      editor: lexicalEditor({
        features: [
          ParagraphFeature(),
          HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
          BoldFeature(),
          ItalicFeature(),
          UnorderedListFeature(),
          OrderedListFeature(),
          // External links only – there are no documents to link to.
          LinkFeature({ enabledCollections: [] }),
          BlocksFeature({
            blocks: [AddressBlock, ContactFormBlock],
            inlineBlocks: [SiteLinkBlock, UpdatedBlock],
          }),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
  ],
};
