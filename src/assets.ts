"use client";

import { createContext, type ReactNode, useContext } from "react";

/** A template from the CMS: the SVG itself and its name in both languages. */
export type Preset = {
  id: string;
  name: Record<"de" | "en", string>;
  markup: string;
};

/**
 * A card in the gallery's fan: its picture (the cutter from above, built
 * from a link – or uploaded by hand, on a white ground), its name and color.
 */
export type GalleryCard = {
  src: string;
  /** Empty: “Cookie Cutter”. */
  name: string;
  /** #rrggbb – null: the first card color. */
  color: string | null;
  /** Built from a link: transparent around the cutter. */
  built: boolean;
};

/**
 * What the editor takes from the CMS (see content.ts): the templates and the
 * gallery's cards – handed over by the page, so a new upload needs no code –
 * and the legal text, already rendered on the server (legal/).
 */
export type Assets = {
  presets: Preset[];
  gallery: GalleryCard[];
  legal?: Partial<Record<"de" | "en", ReactNode>>;
};

export const AssetsContext = createContext<Assets>({
  presets: [],
  gallery: [],
});

export const useAssets = () => useContext(AssetsContext);
