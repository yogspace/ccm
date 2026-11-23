"use client";

import { useEffect } from "react";
import { shortLinkPreview } from "@/export/makerworld";
import { buildFromLink } from "@/fields/short-link-client";
// The picture's shades are read from the color's CSS (card-image.ts
// glazeShades) – without it the background comes out black.
import "@/glaze.css";

/**
 * A creation (a link with its model in it) drawn as a short link's picture
 * – as the admin's browser draws it (fields/short-link-client.ts) – and
 * returned as base64 PNG. Null if nothing came out.
 */
export type DrawPreview = (
  creation: string,
  color: string
) => Promise<string | null>;

declare global {
  interface Window {
    ccmDrawPreview?: DrawPreview;
  }
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  // In slices – one call with every byte overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/** Offers `window.ccmDrawPreview` to the headless browser – nothing to see. */
export const PreviewRenderer = () => {
  useEffect(() => {
    window.ccmDrawPreview = async (creation, color) => {
      const { built } = await buildFromLink(creation);
      const picture = await shortLinkPreview(built.mesh, color);
      return picture ? toBase64(picture) : null;
    };
    return () => {
      window.ccmDrawPreview = undefined;
    };
  }, []);
  return null;
};
