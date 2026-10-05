import {
  type CSSProperties,
  memo,
  startTransition,
  useEffect,
  useState,
} from "react";
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
 * Schieberegler mit einem Schoko-Keks als Knopf (als Bild, nicht live in 3D).
 * Bedient wird ein unsichtbarer, echter Range-Input darüber – Tastatur,
 * Screenreader und Touch wie gewohnt.
 *
 * Der Knopf folgt sofort einem eigenen Wert; die Änderung nach außen läuft
 * als Transition, damit teures Neuzeichnen dahinter ihn nicht ausbremst.
 */
const CookieSlider = ({ min, max, step, value, onChange, label }: Props) => {
  const [thumb, setThumb] = useState<string>();
  const [current, setCurrent] = useState(value);
  const [outside, setOutside] = useState(value);
  // Neuer Wert von außen (z. B. Zurücksetzen) übernimmt den Knopf.
  if (value !== outside) {
    setOutside(value);
    setCurrent(value);
  }
  const fill = (current - min) / (max - min);

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
        onChange={(event) => {
          const next = Number(event.target.value);
          setCurrent(next);
          startTransition(() => onChange(next));
        }}
        step={step}
        type="range"
        value={current}
      />
    </span>
  );
};

export default memo(CookieSlider);
