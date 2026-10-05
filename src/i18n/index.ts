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
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

const syncLang = (lng: string) => {
  document.documentElement.lang = lng;
  document.title = i18n.t("title");
};
syncLang(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncLang);

export default i18n;
