import { Ruler } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { languages } from "../i18n";
import { type Unit, units } from "../units";
import CookieIcon from "./cookie-icon";
import Segmented from "./segmented";

type Props = {
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
};

const unitOptions = units.map((option) => ({ value: option, label: option }));
const languageOptions = languages.map((lng) => ({
  value: lng,
  label: lng.toUpperCase(),
}));

/**
 * Kopf mit Logo, Titel und den Umschaltern für Einheit und Sprache.
 * Memoisiert: Die gleitenden Pillen messen beim Neuzeichnen das Layout aus –
 * das soll nicht bei jeder Reglerbewegung passieren.
 */
const Masthead = ({ unit, onUnitChange }: Props) => {
  const { t, i18n } = useTranslation();

  return (
    <header className="masthead">
      <CookieIcon className="logo" kind="bite" roll={-18} size={100} />
      <div className="masthead-text">
        <h1>Cookie Cutter Maker</h1>
        <p>{t("tagline")}</p>
      </div>
      <div className="switches">
        <Segmented
          className="unit-switch"
          label={t("unit")}
          onChange={onUnitChange}
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
