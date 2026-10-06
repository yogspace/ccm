import { ArrowUpRight, Download } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import RingText from "../components/ring-text";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { filamentFor } from "../filaments";
import type { MeshData } from "../geometry/mesh";
import { readGreeting } from "../greeting";
import { countCreation } from "../stats";
import { formatLength, initialUnit } from "../units";
import { isEmptyDrawing, readHash } from "../url-state";
import CardCutter from "./card-cutter";
import { loadCutter } from "./load-cutter";

const hash = window.location.hash;
const shared = readHash(hash);
const greeting = readGreeting(hash);
const hasShape = shared.rings.length > 0 || !isEmptyDrawing(shared.drawing);

/** Sender and recipient see the same colour: it follows from the drawing. */
const filament = filamentFor(
  new URLSearchParams(hash.replace(/^#/, "")).get("s") ?? hash
);

/** A few sprinkles that burst out from behind the card as it lands. */
const SPRINKLES = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * 360 + (i % 2 ? 11 : -7),
  color: ["#ff5fa8", "#ffffff", "#ffc31f", "#ff6a1f", "#5fb36b"][i % 5],
  reach: 34 + (i % 3) * 5,
}));

const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The greeting card's page: who it is for, the card with the cutter in the
 * middle and the message running around it, who it is from – and the files
 * to print it. One screen, no scrolling.
 */
const CardPage = () => {
  const { t, i18n } = useTranslation();
  const [mesh, setMesh] = useState<MeshData | null>(null);
  const [failed, setFailed] = useState(!hasShape);
  const cardRef = useRef<HTMLDivElement>(null);
  const name = shared.name.trim() || "Cookie Cutter";
  const lang = i18n.resolvedLanguage ?? "en";
  const unit = initialUnit();

  useEffect(() => {
    if (!hasShape) return;
    loadCutter(shared).then(
      (result) => {
        setMesh(result);
        setFailed(!result);
      },
      (error: unknown) => {
        console.error(error);
        setFailed(true);
      }
    );
  }, []);

  useEffect(() => {
    document.title = greeting.to
      ? t("card.titleFor", { name: greeting.to })
      : t("card.title");
  }, [t]);

  // The card leans towards the pointer, as if held in the hand.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || still()) return;
    const lean = (event: PointerEvent) => {
      const { left, top, width, height } = card.getBoundingClientRect();
      const x = (event.clientX - (left + width / 2)) / window.innerWidth;
      const y = (event.clientY - (top + height / 2)) / window.innerHeight;
      card.style.setProperty("--lean-x", `${(-y * 16).toFixed(2)}deg`);
      card.style.setProperty("--lean-y", `${(x * 20).toFixed(2)}deg`);
    };
    const rest = () => {
      card.style.removeProperty("--lean-x");
      card.style.removeProperty("--lean-y");
    };
    window.addEventListener("pointermove", lean);
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", lean);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, []);

  const save = (format: "3mf" | "stl") => {
    if (!mesh) return;
    const file = `${fileBase(name, shared.params.size)}.${format}`;
    download(format === "3mf" ? toThreeMf(mesh, name) : toStl(mesh), file);
    countCreation(hash);
  };

  return (
    <main className="greeting">
      <h1 className="greeting-to">
        {greeting.to ? t("card.for", { name: greeting.to }) : t("card.forYou")}
      </h1>

      <div className="greeting-slot">
        <div className="greeting-stage">
          <RingText text={greeting.message || t("card.ring")} />
          {greeting.message && (
            <p className="visually-hidden">{greeting.message}</p>
          )}
          {!still() &&
            SPRINKLES.map(({ angle, color, reach }) => (
              <i
                aria-hidden
                className="greeting-sprinkle"
                key={angle}
                style={
                  {
                    "--angle": `${angle}deg`,
                    "--color": color,
                    "--reach": `${reach}cqw`,
                  } as CSSProperties
                }
              />
            ))}
          <div className="greeting-card" ref={cardRef}>
            <div className="greeting-paper">
              {mesh ? (
                <CardCutter
                  color={filament}
                  delay={250}
                  label={t("card.cutterAlt", { name })}
                  mesh={mesh}
                />
              ) : (
                <div className="greeting-wait">
                  <CookieIcon kind="star" size={88} spin={!failed} />
                  <span>
                    {failed
                      ? t(hasShape ? "card.failed" : "card.empty")
                      : t("card.loading")}
                  </span>
                </div>
              )}
              <p className="greeting-name">
                <span>{name}</span>
                <small>
                  {formatLength(
                    shared.params.size,
                    unit,
                    lang,
                    unit === "in" ? 1 : 0
                  )}
                </small>
              </p>
            </div>
          </div>
        </div>
      </div>

      {greeting.from && (
        <p className="greeting-from">
          {t("card.fromName", { name: greeting.from })}
        </p>
      )}

      <div className="greeting-actions">
        <Button
          className="primary"
          disabled={!mesh}
          onClick={() => save("3mf")}
          type="button"
        >
          <CookieIcon icing="#2a44ff" icon={Download} roll={12} size={58} />
          {t("card.download")}
        </Button>
        <Button disabled={!mesh} onClick={() => save("stl")} type="button">
          <CookieIcon icon={Download} roll={-14} size={58} />
          {t("card.stl")}
        </Button>
      </div>
      <p className="greeting-hint">{t("card.printHint")}</p>

      <a className="greeting-cta" href="/">
        {t("card.makeOwn")}
        <CookieIcon icing="#ff5fa8" icon={ArrowUpRight} size={40} />
      </a>
    </main>
  );
};

export default CardPage;
