import type {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedInlineBlockNode,
} from "@payloadcms/richtext-lexical";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import {
  type JSXConvertersFunction,
  RichText,
} from "@payloadcms/richtext-lexical/react";
import type { ReactNode } from "react";
import ContactForm from "../components/contact-form";
import type { LegalText } from "../content";
import { LOCALES, type Locale } from "../seo";
import type { Site, SiteLinks } from "../site-defaults";

type SiteLinkFields = { link: keyof SiteLinks; label: string };

type Nodes =
  | DefaultNodeTypes
  | SerializedBlockNode<{ blockType: "address" | "contactForm" }>
  | SerializedInlineBlockNode<
      ({ blockType: "siteLink" } & SiteLinkFields) | { blockType: "updated" }
    >;

type Props = {
  data: SerializedEditorState;
  site: Site;
  locale: Locale;
  /** When the text was last saved – for the “Last updated” block. */
  updatedAt: string | null;
};

/**
 * The legal text from the CMS as the dialog draws it – rendered on the
 * server and handed to the editor. The default converters give headings,
 * paragraphs, lists and links the page's own look (.legal in index.css);
 * the text's own blocks (legal/blocks.ts) get theirs here.
 */
const LegalContent = ({ data, site, locale, updatedAt }: Props) => {
  const converters: JSXConvertersFunction<Nodes> = ({ defaultConverters }) => ({
    ...defaultConverters,
    blocks: {
      address: () => (
        <address>
          {site.address.name}
          <br />
          {site.address.street}
          <br />
          {site.address.city}
          <br />
          {site.address.country}
        </address>
      ),
      contactForm: () => <ContactForm />,
    },
    inlineBlocks: {
      siteLink: ({ node }) => {
        const { link, label } = node.fields as unknown as SiteLinkFields;
        return (
          <a href={site.links[link]} rel="noopener" target="_blank">
            {label}
          </a>
        );
      },
      updated: () =>
        updatedAt ? (
          <time dateTime={updatedAt}>
            {new Date(updatedAt).toLocaleDateString(
              locale === "de" ? "de-DE" : "en-GB",
              { day: "numeric", month: "long", year: "numeric" }
            )}
          </time>
        ) : null,
    },
  });
  return <RichText converters={converters} data={data} disableContainer />;
};

/**
 * The legal text in both languages for a page – rendered here, on the
 * server; the language switch changes without a reload.
 */
export const legalByLocale = (legal: LegalText, site: Site) =>
  Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      <LegalContent
        data={legal.content[locale]}
        key={locale}
        locale={locale}
        site={site}
        updatedAt={legal.updatedAt}
      />,
    ])
  ) as Record<Locale, ReactNode>;

export default LegalContent;
