import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { createStats } from "./api/stats.mjs";

const SITE = "https://ccm.mxwr.de";
type Lang = "de" | "en";

/** Texte für Suchmaschinen und Link-Vorschauen, je Sprache. */
const SEO: Record<
  Lang,
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

const seoTags = (lang: Lang) => {
  const text = SEO[lang];
  const other: Lang = lang === "de" ? "en" : "de";
  const url = `${SITE}/${lang}/`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Cookie Cutter Maker",
    url,
    description: text.description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript and WebAssembly",
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    image: text.ogImage,
    author: {
      "@type": "Person",
      name: "Maximilian Weber",
      url: "https://mxwr.de",
    },
  };
  return [
    `<title>${text.title}</title>`,
    `<meta content="${text.description}" name="description" />`,
    `<link href="${url}" rel="canonical" />`,
    `<link href="${SITE}/de/" hreflang="de" rel="alternate" />`,
    `<link href="${SITE}/en/" hreflang="en" rel="alternate" />`,
    `<link href="${SITE}/" hreflang="x-default" rel="alternate" />`,
    `<meta content="website" property="og:type" />`,
    `<meta content="Cookie Cutter Maker" property="og:site_name" />`,
    `<meta content="${url}" property="og:url" />`,
    `<meta content="${text.ogTitle}" property="og:title" />`,
    `<meta content="${text.ogDescription}" property="og:description" />`,
    `<meta content="${text.ogImage}" property="og:image" />`,
    `<meta content="1200" property="og:image:width" />`,
    `<meta content="630" property="og:image:height" />`,
    `<meta content="${text.ogImageAlt}" property="og:image:alt" />`,
    `<meta content="${text.locale}" property="og:locale" />`,
    `<meta content="${SEO[other].locale}" property="og:locale:alternate" />`,
    `<meta content="summary_large_image" name="twitter:card" />`,
    `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
  ]
    .map((line) => `    ${line}`)
    .join("\n");
};

const localize = (html: string, lang: Lang) =>
  html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(
      /<!-- seo[\s\S]*?<!-- \/seo -->/,
      `<!-- seo -->\n${seoTags(lang)}\n    <!-- /seo -->`
    )
    .replace(
      /<!-- noscript -->[\s\S]*?<!-- \/noscript -->/,
      `<!-- noscript -->${SEO[lang].noscript}<!-- /noscript -->`
    );

/**
 * Eine Seite je Sprache: /de/ und /en/ mit eigenen Texten für Google und
 * Link-Vorschauen. Die Wurzel (und der Dev-Server) bekommt Englisch; „/“
 * leitet der Server je nach Browsersprache weiter (siehe Caddyfile).
 */
const localizedPages = (): Plugin => {
  let outDir = "dist";
  return {
    name: "ccm-localized-pages",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    transformIndexHtml: (html) => localize(html, "en"),
    closeBundle() {
      const file = join(outDir, "index.html");
      let html: string;
      try {
        html = readFileSync(file, "utf8");
      } catch {
        return; // z. B. SSR-Builds ohne index.html
      }
      for (const lang of ["de", "en"] as const) {
        mkdirSync(join(outDir, lang), { recursive: true });
        writeFileSync(join(outDir, lang, "index.html"), localize(html, lang));
      }
    },
  };
};

/**
 * Zähler „x Kreationen erstellt“ auch im Dev-Server und in der Vorschau – mit
 * derselben Logik wie der API-Container, Daten lokal in api/.data/.
 */
const statsApi = (): Plugin => {
  const stats = createStats(
    fileURLToPath(new URL("./api/.data/", import.meta.url))
  );
  return {
    name: "ccm-stats-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!stats.handle(request, response)) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!stats.handle(request, response)) next();
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localizedPages(), statsApi()],
  // manifold-3d lädt sein WASM selbst und enthält Node-Zweige, die der
  // Dependency-Prebundler nicht anfassen soll.
  optimizeDeps: { exclude: ["manifold-3d"] },
  // Der Geometrie-Worker lädt manifold per dynamischem Import – das geht nur als ES-Modul.
  worker: { format: "es" },
});
