import type { Metadata } from "next";

export const SITE = "https://ccm.mxwr.de";
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** Texts for search engines and link previews, per language. */
const SEO: Record<
  Locale,
  {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogImageAlt: string;
    locale: string;
    noscript: string;
  }
> = {
  de: {
    title: "Cookie Cutter Maker – Ausstecher selbst gestalten und 3D-drucken",
    description:
      "Form malen oder SVG hochladen und daraus kostenlos einen druckfertigen Plätzchen-Ausstecher machen. Export als 3MF und STL für Bambu Studio, PrusaSlicer und Co. Läuft komplett im Browser.",
    ogTitle: "Cookie Cutter Maker – Ausstecher selbst gestalten",
    ogDescription:
      "Form malen oder SVG hochladen – raus kommt ein druckfertiger Ausstecher als 3MF oder STL.",
    ogImage: `${SITE}/og-image-de.png`,
    ogImageAlt: "Ein herzförmiger Ausstecher als 3D-Modell",
    locale: "de_DE",
    noscript:
      "Cookie Cutter Maker: Form malen oder SVG hochladen und daraus einen druckfertigen Ausstecher (3MF/STL) machen. Benötigt JavaScript.",
  },
  en: {
    title:
      "Cookie Cutter Maker – design your own cookie cutters and 3D print them",
    description:
      "Draw a shape or upload an SVG and turn it into a print-ready cookie cutter for free. Export as 3MF and STL for Bambu Studio, PrusaSlicer and more. Runs entirely in your browser.",
    ogTitle: "Cookie Cutter Maker – design your own cookie cutters",
    ogDescription:
      "Draw a shape or upload an SVG – get a print-ready cookie cutter as 3MF or STL.",
    ogImage: `${SITE}/og-image.png`,
    ogImageAlt: "A heart-shaped cookie cutter as a 3D model",
    locale: "en_US",
    noscript:
      "Cookie Cutter Maker: draw a shape or upload an SVG and turn it into a print-ready cookie cutter (3MF/STL). Requires JavaScript.",
  },
};

/** The editor page in a language: its own texts for Google and previews. */
export const editorMetadata = (lang: Locale): Metadata => {
  const text = SEO[lang];
  const other: Locale = lang === "de" ? "en" : "de";
  const url = `${SITE}/${lang}`;
  return {
    title: text.title,
    description: text.description,
    manifest: "/manifest.webmanifest",
    alternates: {
      canonical: url,
      languages: {
        de: `${SITE}/de`,
        en: `${SITE}/en`,
        "x-default": `${SITE}/`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Cookie Cutter Maker",
      url,
      title: text.ogTitle,
      description: text.ogDescription,
      images: [
        { url: text.ogImage, width: 1200, height: 630, alt: text.ogImageAlt },
      ],
      locale: text.locale,
      alternateLocale: [SEO[other].locale],
    },
    twitter: { card: "summary_large_image" },
  };
};

/** Structured data for the editor page (JSON-LD). */
export const editorSchema = (lang: Locale) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Cookie Cutter Maker",
  url: `${SITE}/${lang}`,
  description: SEO[lang].description,
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and WebAssembly",
  inLanguage: lang,
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  image: SEO[lang].ogImage,
  author: {
    "@type": "Person",
    name: "Maximilian Weber",
    url: "https://mxwr.de",
  },
});

export const noscriptText = (lang: Locale) => SEO[lang].noscript;

/**
 * The greeting card: its content is in the hash, never on the server – so the
 * preview can only say what every card is, in both languages. And nothing
 * for search engines.
 */
export const cardMetadata: Metadata = {
  title: "Cookie Cutter Maker",
  robots: { index: false },
  openGraph: {
    type: "website",
    siteName: "Cookie Cutter Maker",
    title: "Ein Ausstecher für dich · A cookie cutter for you",
    description:
      "Gestaltet im Cookie Cutter Maker – ansehen und 3D-drucken. · Made with Cookie Cutter Maker – have a look and 3D print it.",
    images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};
