import { RotateCcw } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { type CutterParams, defaultParams } from "../geometry/cutter";
import { formatLength, type Unit } from "../units";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import CookieSlider from "./cookie-slider";

type Props = {
  params: CutterParams;
  onChange: Dispatch<SetStateAction<CutterParams>>;
  unit: Unit;
};

const fields: {
  key: keyof CutterParams;
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

/** Maße-Regler unter der 3D-Ansicht. */
const ParameterPanel = ({ params, onChange, unit }: Props) => {
  const { t, i18n } = useTranslation();
  const changed = fields.some(({ key }) => params[key] !== defaultParams[key]);

  return (
    <div className="params">
      <div className="params-head">
        <h3>{t("params.title")}</h3>
        <Button
          className="ghost"
          disabled={!changed}
          onClick={() => onChange(defaultParams)}
          type="button"
        >
          <CookieIcon icing="#ff5fa8" icon={RotateCcw} roll={-14} size={44} />
          {t("params.reset")}
        </Button>
      </div>
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
              onChange={(value) =>
                onChange((current) => ({ ...current, [key]: value }))
              }
              step={step}
              value={params[key]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParameterPanel;
