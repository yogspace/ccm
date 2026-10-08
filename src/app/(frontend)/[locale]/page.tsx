import type { Metadata } from "next";
import { getAssets, getLegal, getSite } from "@/content";
import EditorRoot from "@/editor-root";
import { legalByLocale } from "@/legal/legal-content";
import {
  editorMetadata,
  editorSchema,
  isLocale,
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
  return (
    <>
      <EditorRoot
        {...assets}
        colors={site.cardColors}
        cookies={site.cookies}
        legal={legalByLocale(legal, site)}
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
