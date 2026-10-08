import { useEffect, useRef } from "react";

type Props = { canvas: HTMLCanvasElement; className?: string };

/** How long a new canvas fades in (index.css: .canvas-view canvas). */
const FADE_MS = 450;

/**
 * Shows a canvas made elsewhere as it is – a picture rendered once, shown
 * here and painted from later, without turning it into an image first. A
 * new one fades in over the one before, which goes once it is covered.
 */
const CanvasView = ({ canvas, className }: Props) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const before = [...box.children].filter((child) => child !== canvas);
    box.append(canvas);
    if (before.length === 0) return;
    const timer = setTimeout(() => {
      for (const old of before) old.remove();
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [canvas]);
  return (
    <span
      className={className ? `canvas-view ${className}` : "canvas-view"}
      ref={ref}
    />
  );
};

export default CanvasView;
