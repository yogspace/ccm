import type { LucideIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import {
  type CookieKind,
  createCookie,
  createIconCookie,
} from "../cookies/models";
import { type CookieHandle, registerCookie } from "../cookies/renderer";

type Props = {
  size: number;
  className?: string;
  /** Dreht sich dauerhaft, z. B. beim Laden. */
  spin?: boolean;
  /** Tempo der Drehung in rad/s (Standard: schnell, wie beim Laden). */
  spinSpeed?: number;
  /** Sanftes Schweben im Leerlauf. */
  idle?: boolean;
  /** Grunddrehung in Grad. */
  roll?: number;
  /** Verzögerung (ms), bevor der Keks hereinwächst. */
  delay?: number;
  /** Neigung nach hinten (rad); Standard: Sorten schräger als Icons. */
  tilt?: number;
  /** Aus: kein Mausblick, kein Drehen beim Hover – z. B. wenn Schrift darauf liegt. */
  interactive?: boolean;
} & (
  | { kind: CookieKind; icon?: never; icing?: never }
  | { icon: LucideIcon; icing?: string; kind?: never }
);

/**
 * Echter 3D-Keks als Icon: entweder eine Keks-Sorte oder ein Lucide-Icon in
 * Keksform. Schaut zur Maus, wenn sie in der Nähe ist, dreht sich beim Hover
 * über den umgebenden Button und gibt beim Klick kurz nach.
 */
const CookieIcon = ({
  size,
  className,
  spin = false,
  spinSpeed = 3.8,
  idle = true,
  roll = 0,
  delay = 0,
  tilt,
  interactive = true,
  kind,
  icon: Icon,
  icing = "#ffffff",
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<HTMLSpanElement>(null);
  const handle = useRef<CookieHandle>(null);
  const iconName = Icon?.displayName ?? Icon?.name;
  // Die Rollung ändert sich oft (Regler) – ohne den Keks neu aufzubauen.
  const rollRef = useRef(roll);
  rollRef.current = roll;
  const delayRef = useRef(delay);
  // Beim Registrieren gleich mitgeben – der Keks lädt asynchron, ein früheres
  // setSpin würde sonst ins Leere gehen.
  const spinRef = useRef({ spin, spinSpeed });
  spinRef.current = { spin, spinSpeed };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const svg = svgRef.current?.querySelector("svg");

    const object =
      kind !== undefined
        ? createCookie(kind)
        : svg
          ? createIconCookie(svg, iconName ?? "icon", icing)
          : null;
    object?.then((cookie) => {
      if (cancelled) return;
      handle.current = registerCookie(canvas, cookie, {
        tilt: tilt ?? (kind ? -0.55 : -0.2),
        roll: (rollRef.current * Math.PI) / 180,
        idle,
        follow: interactive,
        delay: delayRef.current,
        spin: spinRef.current.spin,
        spinSpeed: spinRef.current.spinSpeed / 1000,
      });
    });

    // Der Keks reagiert auf seinen Button: Hover dreht, Klick drückt.
    const button = interactive ? canvas.closest("button, summary, a") : null;
    const flip = () => handle.current?.flip();
    const press = () => handle.current?.press();
    button?.addEventListener("pointerenter", flip);
    button?.addEventListener("pointerdown", press);

    return () => {
      cancelled = true;
      button?.removeEventListener("pointerenter", flip);
      button?.removeEventListener("pointerdown", press);
      handle.current?.dispose();
      handle.current = null;
    };
  }, [kind, iconName, icing, idle, tilt, interactive]);

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
