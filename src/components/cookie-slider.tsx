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

  // An invisible range input over its own track; the cookie lies exactly over
  // the invisible thumb. Its centre (--stop) runs from thumb/2 to
  // 100 % − thumb/2.
  return (
    <span
      className="group/slider relative block h-(--thumb) min-w-0 flex-1 [--stop:calc(var(--thumb)/2+var(--fill)*(100%-var(--thumb)))] [--thumb:2.1rem]"
      style={{ "--fill": fill } as CSSProperties}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-[5px] bg-[linear-gradient(to_right,var(--color-track-fill)_var(--stop),var(--color-track-rest)_var(--stop))]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-(--stop) block size-(--thumb) -translate-1/2 rounded-full transition-[scale] duration-300 ease-spring group-hover/slider:scale-115 group-has-[input:active]/slider:scale-88 group-has-[input:focus-visible]/slider:outline-2 group-has-[input:focus-visible]/slider:outline-offset-1 group-has-[input:focus-visible]/slider:outline-accent"
      >
        {thumb && (
          <img
            alt=""
            className="block size-full animate-[grow-in_0.6s_var(--ease-soft)_both]"
            height={THUMB}
            src={thumb}
            style={{ rotate: `${turn}deg` }}
            width={THUMB}
          />
        )}
      </span>
      <input
        aria-label={label}
        className="absolute inset-0 size-full cursor-grab opacity-0 active:cursor-grabbing [&::-moz-range-thumb]:size-(--thumb) [&::-webkit-slider-thumb]:size-(--thumb)"
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
