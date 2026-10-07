import type { LucideIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import {
  type CookieKind,
  type CookieShape,
  createCookie,
  createIconCookie,
  createShapeCookie,
  disposeCookie,
} from "../cookies/models";
import { type CookieHandle, registerCookie } from "../cookies/renderer";

type Props = {
  size: number;
  className?: string;
  /** Keeps spinning, e.g. while loading. */
  spin?: boolean;
  /** Spin speed in rad/s (default: fast, as while loading). */
  spinSpeed?: number;
  /** Gentle floating while idle. */
  idle?: boolean;
  /** Base rotation in degrees. */
  roll?: number;
  /** Delay (ms) before the cookie grows in. */
  delay?: number;
  /** There at full size right away, without growing in. */
  grown?: boolean;
  /** Backward tilt (rad); default: kinds tilt more than icons. */
  tilt?: number;
  /** Off: no looking at the mouse, no turn on hover – e.g. when text lies on it. */
  interactive?: boolean;
  /** Seen from the side, like a coin on a table – turned via the handle. */
  side?: boolean;
  /** The renderer's handle once the cookie is there (null when it goes). */
  onHandle?: (handle: CookieHandle | null) => void;
  /** Size while growing in (0…1), e.g. so text on it grows along. */
  onGrow?: (scale: number) => void;
} & (
  | { kind: CookieKind; icon?: never; icing?: never; shape?: never }
  | { icon: LucideIcon; icing?: string; kind?: never; shape?: never }
  /** Baked from a creation's contours (see `createShapeCookie`). */
  | { shape: CookieShape; kind?: never; icon?: never; icing?: never }
);

/**
 * A real 3D cookie as an icon: a kind of cookie, a Lucide icon as a cookie or
 * a creation baked as a cookie. Looks at the mouse when it is near, turns on
 * hover over the surrounding button and gives way briefly on click.
 */
const CookieIcon = ({
  size,
  className,
  spin = false,
  spinSpeed = 3.8,
  idle = true,
  roll = 0,
  delay = 0,
  grown = false,
  tilt,
  interactive = true,
  side = false,
  onGrow,
  onHandle,
  kind,
  icon: Icon,
  icing = "#ffffff",
  shape,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<HTMLSpanElement>(null);
  const handle = useRef<CookieHandle>(null);
  const iconName = Icon?.displayName ?? Icon?.name;
  // The roll changes often (sliders) – without rebuilding the cookie.
  const rollRef = useRef(roll);
  rollRef.current = roll;
  const delayRef = useRef(delay);
  // Hand it over on registration – the cookie loads asynchronously, an earlier
  // setSpin would otherwise go nowhere.
  const spinRef = useRef({ spin, spinSpeed });
  spinRef.current = { spin, spinSpeed };
  const onGrowRef = useRef(onGrow);
  onGrowRef.current = onGrow;
  const onHandleRef = useRef(onHandle);
  onHandleRef.current = onHandle;
  // What it was registered with last, and how far it had grown in: registered
  // anew with nothing changed (hot reload, strict mode), it goes on from
  // there instead of popping in again – otherwise every icon flickers.
  const last = useRef<{ key: unknown[]; appear: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const svg = svgRef.current?.querySelector("svg");
    const key = [
      kind,
      iconName,
      icing,
      shape,
      idle,
      tilt,
      interactive,
      grown,
      side,
    ];
    const previous = last.current;
    const from =
      previous?.key.every((value, i) => Object.is(value, key[i])) === true
        ? 0
        : 0;

    // A baked creation is its own; the others share their geometry.
    const baked = kind === undefined && shape ? createShapeCookie(shape) : null;
    const object =
      kind !== undefined
        ? createCookie(kind)
        : baked
          ? Promise.resolve(baked)
          : svg
            ? createIconCookie(svg, iconName ?? "icon", icing)
            : null;
    object?.then((cookie) => {
      if (cancelled) return;
      handle.current = registerCookie(canvas, cookie, {
        tilt: tilt ?? (kind ? -0.55 : -0.2),
        roll: (rollRef.current * Math.PI) / 180,
        side,
        idle,
        follow: interactive,
        delay: delayRef.current,
        grown,
        from,
        spin: spinRef.current.spin,
        spinSpeed: spinRef.current.spinSpeed / 1000,
        onGrow: (scale) => onGrowRef.current?.(scale),
      });
      onHandleRef.current?.(handle.current);
    });

    // The cookie reacts to its button: hover turns it, a click presses it.
    const button = interactive ? canvas.closest("button, a") : null;
    const flip = () => handle.current?.flip();
    const press = () => handle.current?.press();
    button?.addEventListener("pointerenter", flip);
    button?.addEventListener("pointerdown", press);

    return () => {
      cancelled = true;
      last.current = { key, appear: handle.current?.appearance() ?? from };
      button?.removeEventListener("pointerenter", flip);
      button?.removeEventListener("pointerdown", press);
      handle.current?.dispose();
      handle.current = null;
      onHandleRef.current?.(null);
      if (baked) disposeCookie(baked);
    };
  }, [kind, iconName, icing, shape, idle, tilt, interactive, grown, side]);

  useEffect(() => {
    handle.current?.setRoll((roll * Math.PI) / 180);
  }, [roll]);

  useEffect(() => {
    handle.current?.setSpin(spin);
  }, [spin]);

  const pixels = Math.round(size * Math.min(window.devicePixelRatio, 2));

  return (
    <>
      <canvas
        aria-hidden
        className={["cookie", className].filter(Boolean).join(" ")}
        height={pixels}
        ref={canvasRef}
        style={{ "--size": `${size}px` } as CSSProperties}
        width={pixels}
      />
      {Icon && (
        <span hidden ref={svgRef}>
          <Icon />
        </span>
      )}
    </>
  );
};

export default CookieIcon;
