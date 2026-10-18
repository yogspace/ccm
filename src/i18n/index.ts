import { createInstance, type i18n as I18n } from "i18next";
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

/**
 * An i18next of the page's own, with the texts the page brought from the
 * server (both languages – the switch in the masthead changes without a
 * reload), in the page's language (/de, /en). Synchronous, so the first
 * render has them – on the server too, where every page has one of its own.
 */
export const createI18n = (texts: Texts, lng: string): I18n => {
  const i18n = createInstance();
  i18n.use(initReactI18next).init({
    resources: {
      de: { translation: texts.de },
      en: { translation: texts.en },
    },
    lng,
    initAsync: false,
    supportedLngs: languages,
    nonExplicitSupportedLngs: true,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
};

/**
 * In the browser: the page's language, its title and its path follow the
 * switch. Returns the cleanup (for useEffect).
 */
export const followLanguage = (i18n: I18n) => {
  const sync = (lng: string) => {
    document.documentElement.lang = lng;
    document.title = i18n.t("title");
    syncPath(lng);
  };
  i18n.on("languageChanged", sync);
  return () => i18n.off("languageChanged", sync);
};
