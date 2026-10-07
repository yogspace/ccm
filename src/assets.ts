"use client";

import { createContext, useContext } from "react";

/** A template from the CMS: the SVG itself and its name in both languages. */
export type Preset = {
  id: string;
  name: Record<"de" | "en", string>;
  markup: string;
};

/**
 * What the editor takes from the CMS (see content.ts): the templates and the
 * gallery pictures – handed over by the page, so a new upload needs no code.
 */
export type Assets = { presets: Preset[]; gallery: string[] };

export const AssetsContext = createContext<Assets>({
  presets: [],
  gallery: [],
});

export const useAssets = () => useContext(AssetsContext);
