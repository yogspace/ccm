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
    // /de/ bzw. /en/ geben die Sprache vor (die Seiten haben je eigene Texte
    // für Google); ohne Sprachpfad gilt die gespeicherte bzw. die des Browsers.
    detection: {
      order: ["path", "localStorage", "navigator"],
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
    },
  });

/** Sprache auch in der URL: /de/ bzw. /en/ – Hash (geteilte Zeichnung) bleibt. */
const syncPath = (lng: string) => {
  const { pathname, search, hash } = window.location;
  const first = pathname.split("/")[1] ?? "";
  // Fremde Pfade nicht anfassen, nur „/“ und die Sprachseiten.
  if (first && !(languages as readonly string[]).includes(first)) return;
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
