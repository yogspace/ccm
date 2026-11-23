import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

/**
 * Pages only the server's headless browser opens (export/server-preview.ts)
 * – their own root layout: none of the site's styles, fonts or statistics.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const RenderLayout = ({ children }: PropsWithChildren) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RenderLayout;
