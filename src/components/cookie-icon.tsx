import type { LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
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
  /** Sanftes Schweben im Leerlauf. */
  idle?: boolean;
  /** Grunddrehung in Grad. */
  roll?: number;
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
  idle = true,
  roll = 0,
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
        tilt: kind ? -0.55 : -0.2,
        roll: (rollRef.current * Math.PI) / 180,
        idle,
      });
    });

    // Der Keks reagiert auf seinen Button: Hover dreht, Klick drückt.
    const button = canvas.closest("button, summary");
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
  }, [kind, iconName, icing, idle]);

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
        style={{ width: size, height: size }}
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
