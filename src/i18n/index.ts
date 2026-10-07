import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import type { Texts } from "../translations/defaults";
import type { de } from "./de";

export const languages = ["de", "en"] as const;

// The texts in de.ts are the seed and the shape – the ones shown come from the
// Translations global (see translations/).
declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof de };
  }
}

/** The language in the URL too: /de or /en – the hash (shared drawing) stays. */
const syncPath = (lng: string) => {
  const { pathname, search, hash } = window.location;
  // Only “/” and the language pages themselves – not e.g. /de/card.
  if (!/^\/((de|en)\/?)?$/.test(pathname)) return;
  const path = `/${lng}`;
  if (pathname !== path) {
    window.history.replaceState(null, "", `${path}${search}${hash}`);
  }
};

const syncLang = (lng: string) => {
  document.documentElement.lang = lng;
  document.title = i18n.t("title");
  syncPath(lng);
};

/**
 * Starts i18next with the texts the page brought from the server (both
 * languages – the switch in the masthead changes without a reload).
 * Synchronous, so the first render has them; once per page load.
 */
export const setupI18n = (texts: Texts) => {
  if (i18n.isInitialized) return;
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        de: { translation: texts.de },
        en: { translation: texts.en },
      },
      initAsync: false,
      supportedLngs: languages,
      nonExplicitSupportedLngs: true,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      // /de and /en set the language (each page has its own texts for
      // Google); without a language path the stored one or the browser's.
      detection: {
        order: ["path", "localStorage", "navigator"],
        lookupFromPathIndex: 0,
        caches: ["localStorage"],
      },
    });
  syncLang(i18n.resolvedLanguage ?? "en");
  i18n.on("languageChanged", syncLang);
};

export default i18n;
