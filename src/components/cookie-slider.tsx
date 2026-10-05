import { type CSSProperties, useEffect, useState } from "react";
import { cookieImage } from "../cookies/renderer";

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
};

const THUMB = 34;

/**
 * Schieberegler mit einem Schoko-Keks als Knopf (als Bild, nicht live in 3D),
 * der beim Schieben mitrollt. Bedient wird ein unsichtbarer, echter
 * Range-Input darüber – Tastatur, Screenreader und Touch wie gewohnt.
 */
const CookieSlider = ({ min, max, step, value, onChange, label }: Props) => {
  const [thumb, setThumb] = useState<string>();
  const fill = (value - min) / (max - min);

  useEffect(() => {
    const pixels = Math.round(THUMB * Math.min(window.devicePixelRatio, 2));
    cookieImage("chip", pixels).then(setThumb);
  }, []);

  return (
    <span className="slider" style={{ "--fill": fill } as CSSProperties}>
      <span aria-hidden className="slider-track" />
      <span aria-hidden className="slider-thumb">
        {thumb && <img alt="" height={THUMB} src={thumb} width={THUMB} />}
      </span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </span>
  );
};

export default CookieSlider;
