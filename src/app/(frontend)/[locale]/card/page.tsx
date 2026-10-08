import type { Viewport } from "next";
import CardRoot from "@/card/card-root";
import { getSite } from "@/content";
import { GLAZE_SCRIPT_ID, glazeScript } from "@/glaze";
import { cardMetadata } from "@/seo";
import { getTexts } from "@/translations/texts";
import "@/card/card.css";

export const metadata = cardMetadata;

// Rendered per request: texts and links come from the admin (cached until
// saved, see cache.ts).
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  // The card reaches into the safe areas (notch, home bar) – see card.css.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2a44ff" },
    { media: "(prefers-color-scheme: dark)", color: "#141c86" },
  ],
};

/** A greeting card: /de/card and /en/card – the card itself is in the hash. */
const GreetingCardPage = async () => {
  const [texts, site] = await Promise.all([getTexts(), getSite()]);
  return (
    <>
      {/* The card's favourite colour on the page before its first paint. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own script, the colours checked by the CMS
        dangerouslySetInnerHTML={{
          __html: glazeScript(site.cardColors.map(({ color }) => color)),
        }}
        id={GLAZE_SCRIPT_ID}
      />
      <CardRoot colors={site.cardColors} links={site.links} texts={texts} />
      <noscript>Cookie Cutter Maker – this card needs JavaScript.</noscript>
    </>
  );
};

export default GreetingCardPage;
