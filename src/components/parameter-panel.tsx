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

type Field = {
  key: Exclude<keyof CutterParams, "cutouts" | "mirror">;
  min: number;
  max: number;
  step: number;
};

const fields: Field[] = [
  { key: "size", min: 30, max: 200, step: 1 },
  { key: "bladeHeight", min: 8, max: 30, step: 0.5 },
  { key: "wall", min: 0.8, max: 2.4, step: 0.1 },
  { key: "edge", min: 0.4, max: 1.2, step: 0.1 },
  { key: "taper", min: 0, max: 10, step: 0.2 },
  { key: "flangeWidth", min: 0, max: 12, step: 0.5 },
  { key: "flangeHeight", min: 1, max: 4, step: 0.2 },
  { key: "smoothing", min: 0, max: 5, step: 0.1 },
];

/** Only matters with cut-out inner shapes – shown next to that checkbox. */
const bridgeField: Field = { key: "bridgeWidth", min: 1.5, max: 8, step: 0.5 };

/**
 * An on/off parameter as a checkbox with a cookie tick (a real input, just
 * invisible). The tick stays rendered: unticking lets it shrink away via CSS.
 */
const Toggle = ({
  name,
  label,
  hint,
}: {
  name: "cutouts" | "mirror";
  label: string;
  hint: string;
}) => {
  const { params } = useSnapshot(store);
  return (
    <label className="checkbox" title={hint}>
      <input
        checked={params[name] === 1}
        onChange={(event) => setParam(name, event.target.checked ? 1 : 0)}
        type="checkbox"
      />
      <span aria-hidden className="checkbox-box">
        <CookieIcon icing="#00b86b" icon={Check} roll={-8} size={60} />
      </span>
      {label}
    </label>
  );
};

/**
 * Dimension sliders below the 3D view: heading, the checkbox for cutting out
 * inner shapes (with the bridge width next to it while it is on), the
 * sliders, and reset at the very bottom.
 */
const ParameterPanel = () => {
  const { t, i18n } = useTranslation();
  const { params, unit } = useSnapshot(store);
  const changed = (Object.keys(defaultParams) as (keyof CutterParams)[]).some(
    (key) => params[key] !== defaultParams[key]
  );
  const cutouts = params.cutouts === 1;

  const slider = ({ key, min, max, step }: Field) => (
    <div className="param" key={key} title={t(`params.${key}`)}>
      {/* Value above the slider: its width stays fixed however wide the number gets. */}
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
  );

  return (
    <div className="params">
      <h3>{t("params.title")}</h3>
      <div className="params-grid">
        {/* Shapes inside shapes become holes – or, as before, only the
            outside counts. */}
        <Toggle
          hint={t("params.cutoutsHint")}
          label={t("params.cutouts")}
          name="cutouts"
        />
        {/* Always laid out (no jump), faded out and inert while unticked. */}
        <div
          aria-hidden={!cutouts}
          className="bridge-width"
          data-off={!cutouts || undefined}
          inert={!cutouts}
        >
          {slider(bridgeField)}
        </div>
      </div>
      <div className="params-grid">
        {/* The cutter is used upside down – mirrored, text on the cookie reads right. */}
        <Toggle
          hint={t("params.mirrorHint")}
          label={t("params.mirror")}
          name="mirror"
        />
      </div>
      <div className="params-grid">{fields.map(slider)}</div>
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
