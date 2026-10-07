import type { Viewport } from "next";
import CardRoot from "@/card/card-root";
import { getSite } from "@/content";
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
      <CardRoot links={site.links} texts={texts} />
      <noscript>Cookie Cutter Maker – this card needs JavaScript.</noscript>
    </>
  );
};

export default GreetingCardPage;
