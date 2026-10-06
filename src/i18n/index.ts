import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { de } from "./de";
import { en } from "./en";

export const languages = ["de", "en"] as const;

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof de };
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en } },
    supportedLngs: languages,
    nonExplicitSupportedLngs: true,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    // /de/ and /en/ set the language (each page has its own texts for
    // Google); without a language path the stored one or the browser's counts.
    detection: {
      order: ["path", "localStorage", "navigator"],
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
    },
  });

/** The language in the URL too: /de/ or /en/ – the hash (shared drawing) stays. */
const syncPath = (lng: string) => {
  const { pathname, search, hash } = window.location;
  // Only “/” and the language pages themselves – not e.g. /de/card/.
  if (!/^\/((de|en)\/?)?$/.test(pathname)) return;
  const path = `/${lng}/`;
  if (pathname !== path) {
    window.history.replaceState(null, "", `${path}${search}${hash}`);
  }
};

const syncLang = (lng: string) => {
  document.documentElement.lang = lng;
  document.title = i18n.t("title");
  syncPath(lng);
};
syncLang(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncLang);

export default i18n;
