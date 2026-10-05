import { Check, RotateCcw } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { type CutterParams, defaultParams } from "../geometry/cutter";
import { resetParams, setParam, store } from "../store";
import { formatLength } from "../units";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import CookieSlider from "./cookie-slider";

const fields: {
  key: Exclude<keyof CutterParams, "cutouts">;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "size", min: 30, max: 200, step: 1 },
  { key: "bladeHeight", min: 8, max: 30, step: 0.5 },
  { key: "wall", min: 0.8, max: 2.4, step: 0.1 },
  { key: "edge", min: 0.4, max: 1.2, step: 0.1 },
  { key: "taper", min: 0, max: 10, step: 0.2 },
  { key: "flangeWidth", min: 0, max: 12, step: 0.5 },
  { key: "flangeHeight", min: 1, max: 4, step: 0.2 },
  { key: "smoothing", min: 0, max: 5, step: 0.1 },
];

/**
 * Maße-Regler unter der 3D-Ansicht: Überschrift, Löcher-Checkbox in eigener
 * Zeile, die Regler, ganz unten Zurücksetzen.
 */
const ParameterPanel = () => {
  const { t, i18n } = useTranslation();
  const { params, unit } = useSnapshot(store);
  const changed = (Object.keys(defaultParams) as (keyof CutterParams)[]).some(
    (key) => params[key] !== defaultParams[key]
  );
  const cutouts = params.cutouts === 1;

  return (
    <div className="params">
      <h3>{t("params.title")}</h3>
      {/* Formen in Formen als Löcher ausschneiden – oder wie früher nur außen.
          Echte Checkbox, das Häkchen ist ein Keks. */}
      <label className="checkbox" title={t("params.cutoutsHint")}>
        <input
          checked={cutouts}
          onChange={(event) =>
            setParam("cutouts", event.target.checked ? 1 : 0)
          }
          type="checkbox"
        />
        {/* Bleibt gerendert: Abwählen lässt es per CSS schrumpfen, bis es weg ist. */}
        <span aria-hidden className="checkbox-box">
          <CookieIcon icing="#00b86b" icon={Check} roll={-8} size={60} />
        </span>
        {t("params.cutouts")}
      </label>
      <div className="params-grid">
        {fields.map(({ key, min, max, step }) => (
          <div className="param" key={key} title={t(`params.${key}`)}>
            {/* Wert über dem Regler: So bleibt dessen Breite fest, egal wie breit die Zahl wird. */}
            <span className="param-head">
              <span className="param-label">{t(`params.${key}`)}</span>
              <output>
                {formatLength(params[key], unit, i18n.resolvedLanguage)}
              </output>
            </span>
            <CookieSlider
              label={t(`params.${key}`)}
              max={max}
              min={min}
              onChange={(value) => setParam(key, value)}
              step={step}
              value={params[key]}
            />
          </div>
        ))}
      </div>
      <Button
        className="ghost reset"
        disabled={!changed}
        onClick={resetParams}
        type="button"
      >
        <CookieIcon icing="#ff5fa8" icon={RotateCcw} roll={-14} size={44} />
        {t("params.reset")}
      </Button>
    </div>
  );
};

export default memo(ParameterPanel);
