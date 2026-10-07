import type { Metadata } from "next";
import { getAssets, getLegal, getSite } from "@/content";
import EditorRoot from "@/editor-root";
import LegalContent from "@/legal/legal-content";
import {
  editorMetadata,
  editorSchema,
  isLocale,
  LOCALES,
  type Locale,
  noscriptText,
} from "@/seo";
import { getTexts } from "@/translations/texts";

// Rendered per request: texts, templates, gallery, links and the legal text
// come from the admin (cached until saved, see cache.ts).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

const localeOf = async (params: Props["params"]): Promise<Locale> => {
  const { locale } = await params;
  return isLocale(locale) ? locale : "en";
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> =>
  editorMetadata(await localeOf(params));

/** The editor: /de and /en, each with its own texts for search engines. */
const EditorPage = async ({ params }: Props) => {
  const lang = await localeOf(params);
  const [assets, texts, site, legal] = await Promise.all([
    getAssets(),
    getTexts(),
    getSite(),
    getLegal(),
  ]);
  // The legal text in both languages, rendered here – the language switch
  // in the editor changes without a reload.
  const legalContent = Object.fromEntries(
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
  );
  return (
    <>
      <EditorRoot
        {...assets}
        legal={legalContent}
        links={site.links}
        texts={texts}
      />
      <noscript>{noscriptText(lang)}</noscript>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD from seo.ts
        dangerouslySetInnerHTML={{ __html: JSON.stringify(editorSchema(lang)) }}
        type="application/ld+json"
      />
    </>
  );
};

export default EditorPage;
