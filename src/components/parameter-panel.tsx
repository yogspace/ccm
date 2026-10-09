import { Check, RotateCcw } from "lucide-react";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { cn } from "../cn";
import {
  type CutterParams,
  defaultParams,
  flangeOf,
  SIZE_RANGE,
} from "../geometry/cutter";
import { SIGNATURE_BAND } from "../geometry/signature";
import { resetParams, setParam, store } from "../store";
import { formatLength } from "../units";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import CookieSlider from "./cookie-slider";
import { cookieInButton } from "./styles";

type Field = {
  key: Exclude<keyof CutterParams, "cutouts" | "mirror">;
  min: number;
  max: number;
  step: number;
};

const fields: Field[] = [
  { key: "size", ...SIZE_RANGE, step: 1 },
  { key: "bladeHeight", min: 8, max: 30, step: 0.5 },
  { key: "wall", min: 0.8, max: 2.4, step: 0.1 },
  { key: "edge", min: 0.4, max: 1.2, step: 0.1 },
  { key: "taper", min: 0, max: 10, step: 0.2 },
  { key: "flangeWidth", min: 0, max: 12, step: 0.1 },
  { key: "flangeHeight", min: 1, max: 4, step: 0.2 },
  { key: "smoothing", min: 0, max: 5, step: 0.1 },
];

/** Only matters with cut-out inner shapes – shown next to that checkbox. */
const bridgeField: Field = { key: "bridgeWidth", min: 1.5, max: 8, step: 0.5 };

/**
 * Only matters with embossing – shown once something is drawn in its ink, up
 * to the blade height.
 */
const reliefField: Field = { key: "relief", min: 0, max: 15, step: 0.1 };

/**
 * A slider that does nothing right now (no inner shapes cut out, nothing
 * drawn in pink): still there, so nothing jumps – faded and inert.
 */
const Idle = ({
  idle,
  hint,
  children,
}: {
  idle: boolean;
  hint: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "transition-opacity duration-300 ease-soft",
      idle && "opacity-35"
    )}
    inert={idle}
    title={idle ? hint : undefined}
  >
    {children}
  </div>
);

/**
 * An on/off parameter as a checkbox with a cookie tick (a real input, just
 * invisible). The tick stays rendered: unticking lets it shrink away via CSS.
 */
const Toggle = ({
  name,
  label,
  hint,
  className,
}: {
  name: "cutouts" | "mirror";
  label: string;
  hint: string;
  className?: string;
}) => {
  const { params } = useSnapshot(store);
  return (
    <label
      className={cn(
        "group/checkbox inline-flex cursor-pointer items-center gap-2 text-body font-bold text-ink select-none",
        className
      )}
      title={hint}
    >
      <input
        checked={params[name] === 1}
        className="pointer-events-none absolute size-px opacity-0"
        onChange={(event) => setParam(name, event.target.checked ? 1 : 0)}
        type="checkbox"
      />
      <span
        aria-hidden
        className="relative grid size-6 flex-none place-items-center rounded-md bg-field transition-[scale] duration-300 ease-spring group-hover/checkbox:scale-108 group-active/checkbox:scale-92 group-has-[input:focus-visible]/checkbox:outline-2 group-has-[input:focus-visible]/checkbox:outline-offset-2 group-has-[input:focus-visible]/checkbox:outline-accent"
      >
        {/* The tick is larger than the box, it sticks out. It springs in …
            and shrinks when unticked until it is gone. */}
        <CookieIcon
          className="absolute m-0 [transition:scale_0.4s_var(--ease-spring),visibility_0s] group-has-[input:not(:checked)]/checkbox:invisible group-has-[input:not(:checked)]/checkbox:scale-0 group-has-[input:not(:checked)]/checkbox:[transition:scale_0.25s_cubic-bezier(0.5,0,0.75,0),visibility_0s_0.25s]"
          icing="#00b86b"
          icon={Check}
          roll={-8}
          size={60}
        />
      </span>
      {label}
    </label>
  );
};

/**
 * Dimension sliders below the 3D view: the checkbox for cutting out
 * inner shapes with the bridge width next to it, the sliders – the
 * embossing's height last – and reset at the very bottom. What does nothing
 * right now (bridges without cut-outs, embossing without pink) stays, faded.
 */
const ParameterPanel = () => {
  const { t, i18n } = useTranslation();
  const { params, unit, emboss } = useSnapshot(store);
  const changed = (Object.keys(defaultParams) as (keyof CutterParams)[]).some(
    (key) => params[key] !== defaultParams[key]
  );
  const cutouts = params.cutouts === 1;

  const slider = (
    { key, min, max, step }: Field,
    value: number = params[key]
  ) => (
    <div
      className="flex flex-col gap-2 text-body"
      key={key}
      title={t(`params.${key}`)}
    >
      {/* Value above the slider: its width stays fixed however wide the number gets. */}
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-muted">
          {t(`params.${key}`)}
        </span>
        <output className="flex-none font-bold whitespace-nowrap text-ink tabular-nums">
          {formatLength(value, unit, i18n.resolvedLanguage)}
        </output>
      </span>
      <CookieSlider
        label={t(`params.${key}`)}
        max={max}
        min={min}
        onChange={(value) => setParam(key, value)}
        step={step}
        value={value}
      />
    </div>
  );

  // Two columns, one when narrow, four when wide.
  const grid =
    "grid grid-cols-2 gap-x-10 gap-y-4 @max-sm:grid-cols-1 @min-[50rem]:grid-cols-4";

  return (
    <div className="flex flex-col gap-4 @container">
      <div className={grid}>
        {/* Shapes inside shapes become holes – or, as before, only the
            outside counts. Built like a slider (an empty label line, then
            the checkbox where the track is), so it lines up with the bridge
            width's slider beside it. */}
        <div className="flex flex-col gap-2 text-body">
          <span
            aria-hidden
            className="flex items-baseline justify-between gap-2"
          >
            &nbsp;
          </span>
          {/* Like the slider, no height of its own – centred on the line
              where the track runs. */}
          <Toggle
            className="h-0"
            hint={t("params.cutoutsHint")}
            label={t("params.cutouts")}
            name="cutouts"
          />
        </div>
        <Idle hint={t("params.bridgeIdle")} idle={!cutouts}>
          {slider(bridgeField)}
        </Idle>
      </div>
      <div className={grid}>
        {fields.map((field) =>
          // The flange carries the maker's mark: never narrower than it
          // needs – the slider starts there and shows what is built.
          field.key === "flangeWidth"
            ? slider(
                { ...field, min: params.wall + SIGNATURE_BAND },
                flangeOf(params)
              )
            : slider(field)
        )}
        {/* Last: the embossing's height – as high as the walls at most, the
            slider ends at the blade height and shows what is built. */}
        <Idle hint={t("params.reliefIdle")} idle={emboss.length === 0}>
          {slider(
            { ...reliefField, max: params.bladeHeight },
            Math.min(params.relief, params.bladeHeight)
          )}
        </Idle>
      </div>
      {/* At the bottom: mirroring (the cutter is used upside down – mirrored,
          text on the cookie reads right) and reset. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Toggle
          hint={t("params.mirrorHint")}
          label={t("params.mirror")}
          name="mirror"
        />
        <Button
          disabled={!changed}
          kind="ghost"
          onClick={resetParams}
          type="button"
        >
          <CookieIcon
            className={cookieInButton}
            icing="#ff5fa8"
            icon={RotateCcw}
            roll={-14}
            size={44}
          />
          {t("params.reset")}
        </Button>
      </div>
    </div>
  );
};

export default memo(ParameterPanel);
