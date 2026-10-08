import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale, SITE } from "@/seo";
// The colour scheme first: the app's own rules may add to it (index.css).
import "@/glaze.css";
import "@/index.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  authors: [{ name: "Maximilian Weber" }],
  // Outgoing links name their origin (only the domain, never the hash with
  // the shape).
  referrer: "strict-origin-when-cross-origin",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2a44ff" },
    { media: "(prefers-color-scheme: dark)", color: "#141c86" },
  ],
};

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

/** The pages in a language: /de and /en, the greeting card below them. */
const LocaleLayout = async ({ children, params }: Props) => {
  const { locale } = await params;
  // Only /de and /en – anything else is not a page.
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <head>
        <link
          as="font"
          crossOrigin=""
          href="/fonts/Pally-Variable.woff2"
          rel="preload"
          type="font/woff2"
        />
      </head>
      <body>{children}</body>
    </html>
  );
};

export default LocaleLayout;
