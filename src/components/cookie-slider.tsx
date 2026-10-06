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
 * Slider with a chocolate chip cookie as its thumb (as an image, not live 3D).
 * It is operated through an invisible, real range input on top – keyboard,
 * screen readers and touch work as usual.
 *
 * The thumb follows its own value right away; the change goes out as a
 * transition, so expensive re-rendering behind it does not slow it down.
 */
const CookieSlider = ({ min, max, step, value, onChange, label }: Props) => {
  const [thumb, setThumb] = useState<string>();
  // Every cookie lies differently – otherwise all sliders look the same.
  const [turn] = useState(() => Math.round(Math.random() * 360));
  const [current, setCurrent] = useState(value);
  const [outside, setOutside] = useState(value);
  // A new value from outside (e.g. reset) takes over the thumb.
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
        {thumb && (
          <img
            alt=""
            height={THUMB}
            src={thumb}
            style={{ rotate: `${turn}deg` }}
            width={THUMB}
          />
        )}
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
