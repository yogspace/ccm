import { Ruler } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { languages } from "../i18n";
import { setUnit, store } from "../store";
import { units } from "../units";
import CookieIcon from "./cookie-icon";
import Segmented from "./segmented";
import SharePanel from "./share-panel";

const unitOptions = units.map((option) => ({ value: option, label: option }));
const languageOptions = languages.map((lng) => ({
  value: lng,
  label: lng.toUpperCase(),
}));

/**
 * Header with logo, title – sharing the page right behind it – and the
 * switches for unit and language. Memoised:
 * the gliding markers measure the layout on every render – that should not
 * happen on every slider move.
 */
const Masthead = () => {
  const { t, i18n } = useTranslation();
  const { unit } = useSnapshot(store);

  return (
    <header className="masthead">
      <CookieIcon className="logo" kind="bite" roll={-18} size={100} />
      <div className="masthead-text">
        <div className="masthead-title">
          <h1>Cookie Cutter Maker</h1>
          <SharePanel />
        </div>
        <p>{t("tagline")}</p>
      </div>
      <div className="switches">
        <Segmented
          className="unit-switch"
          label={t("unit")}
          onChange={setUnit}
          options={unitOptions}
          value={unit}
        >
          <CookieIcon icing="#2a44ff" icon={Ruler} roll={35} size={44} />
        </Segmented>
        <Segmented
          label={t("language")}
          onChange={(lng) => i18n.changeLanguage(lng)}
          options={languageOptions}
          value={i18n.resolvedLanguage ?? "en"}
        />
      </div>
    </header>
  );
};

export default memo(Masthead);
