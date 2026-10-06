import { ArrowUpRight, Download, RotateCw } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import RingText from "../components/ring-text";
import { cookieSeed } from "../cookie-jar";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { filamentFor } from "../filaments";
import { readGreeting } from "../greeting";
import { drawingKey } from "../hash-text";
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
const filament = filamentFor(drawingKey(hash));

/** A few sprinkles that burst out from behind the card – as it lands, and on every turn. */
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
 * to print it. One screen, no scrolling. A click turns the card over: on its
 * back lies the cookie the cutter bakes.
 */
const CardPage = () => {
  const { t, i18n } = useTranslation();
  const [cutter, setCutter] =
    useState<Awaited<ReturnType<typeof loadCutter>>>(null);
  const [failed, setFailed] = useState(!hasShape);
  /** Counts the tries – “Try again” starts another. */
  const [attempt, setAttempt] = useState(0);
  /** Turned over: the cookie side up. Every turn bursts sprinkles again. */
  const [turns, setTurns] = useState(0);
  const flipped = turns % 2 === 1;
  const mesh = cutter?.mesh ?? null;
  const cookie = useMemo(
    () =>
      cutter && {
        dough: cutter.outline,
        icing: cutter.icing,
        seed: cookieSeed(cutter.outline),
      },
    [cutter]
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const name = shared.name.trim() || "Cookie Cutter";
  const lang = i18n.resolvedLanguage ?? "en";
  const unit = initialUnit();
  const heading = greeting.to
    ? t("card.for", { name: greeting.to })
    : t("card.forYou");

  // biome-ignore lint/correctness/useExhaustiveDependencies: every try shapes it anew
  useEffect(() => {
    if (!hasShape) return;
    let current = true;
    setFailed(false);
    loadCutter(shared).then(
      (result) => {
        if (!current) return;
        setCutter(result);
        setFailed(!result);
      },
      (error: unknown) => {
        console.error("The cutter could not be shaped", error);
        if (current) setFailed(true);
      }
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    document.title = greeting.to
      ? t("card.titleFor", { name: greeting.to })
      : t("card.title");
  }, [t]);

  // Back from the back/forward cache, its 3D views gave their memory away
  // (card-cutter.tsx) – so start afresh.
  useEffect(() => {
    const back = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);

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

  /** A sticker in the corner: this card turns over. */
  const turnSticker = (
    <span aria-hidden className="greeting-turn">
      <CookieIcon
        className="greeting-turn-icon"
        icing="#2a44ff"
        icon={RotateCw}
        idle={false}
        size={56}
      />
    </span>
  );

  const save = (format: "3mf" | "stl") => {
    if (!mesh) return;
    const file = `${fileBase(name, shared.params.size)}.${format}`;
    download(format === "3mf" ? toThreeMf(mesh, name) : toStl(mesh), file);
    countCreation(hash);
  };

  return (
    <main className="greeting">
      <h1
        className="greeting-to"
        // Long names get smaller instead of taking several lines.
        style={{ "--chars": heading.length } as CSSProperties}
      >
        {heading}
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
                key={`${turns}-${angle}`}
                style={
                  {
                    "--angle": `${angle}deg`,
                    "--color": color,
                    "--reach": `${reach}cqw`,
                    "--delay": turns === 0 ? "0.7s" : "0.3s",
                  } as CSSProperties
                }
              />
            ))}
          <div className="greeting-card" ref={cardRef}>
            <button
              aria-label={t(flipped ? "card.flipBack" : "card.flip")}
              aria-pressed={flipped}
              className="greeting-flip"
              data-flipped={flipped || undefined}
              disabled={!cookie}
              onClick={() => setTurns((count) => count + 1)}
              type="button"
            >
              <span className="greeting-paper greeting-front">
                {mesh ? (
                  <CardCutter
                    color={filament}
                    delay={250}
                    label={t("card.cutterAlt", { name })}
                    mesh={mesh}
                    paused={flipped}
                  />
                ) : (
                  <span className="greeting-wait">
                    <CookieIcon
                      idle={false}
                      kind="star"
                      size={88}
                      spin={!failed}
                    />
                    <span aria-live="polite">
                      {failed
                        ? t(hasShape ? "card.failed" : "card.empty")
                        : t("card.loading")}
                    </span>
                  </span>
                )}
                <span className="greeting-name" hidden={!hasShape}>
                  <span>{name}</span>
                  <small>
                    {formatLength(
                      shared.params.size,
                      unit,
                      lang,
                      unit === "in" ? 1 : 0
                    )}
                  </small>
                </span>
                {cookie && turnSticker}
              </span>
              <span className="greeting-paper greeting-back">
                {cookie && (
                  <CookieIcon
                    className="greeting-cookie"
                    // Still: drawn once, no frames while it lies there.
                    idle={false}
                    interactive={false}
                    shape={cookie}
                    size={320}
                    tilt={-0.5}
                  />
                )}
                <span className="greeting-name">
                  <span>{name}</span>
                  <small>{t("card.baked")}</small>
                </span>
                {cookie && turnSticker}
              </span>
            </button>
          </div>
        </div>
      </div>

      {greeting.from && (
        <p
          className="greeting-from"
          style={{ "--chars": greeting.from.length + 4 } as CSSProperties}
        >
          {t("card.fromName", { name: greeting.from })}
        </p>
      )}

      {failed && hasShape && (
        <div className="greeting-actions">
          <Button
            className="primary"
            onClick={() => setAttempt((count) => count + 1)}
            type="button"
          >
            <CookieIcon
              icing="#2a44ff"
              icon={RotateCw}
              idle={false}
              roll={-10}
              size={58}
            />
            {t("card.retry")}
          </Button>
        </div>
      )}
      {!failed && (
        <>
          <div className="greeting-actions">
            <Button
              className="primary"
              disabled={!mesh}
              onClick={() => save("3mf")}
              type="button"
            >
              <CookieIcon
                icing="#2a44ff"
                icon={Download}
                idle={false}
                roll={12}
                size={58}
              />
              {t("card.download")}
            </Button>
            <Button disabled={!mesh} onClick={() => save("stl")} type="button">
              <CookieIcon icon={Download} idle={false} roll={-14} size={58} />
              {t("card.stl")}
            </Button>
          </div>
          <p className="greeting-hint">{t("card.printHint")}</p>
        </>
      )}

      <a className="greeting-cta" href="/">
        {t("card.makeOwn")}
        <CookieIcon
          icing="#ff5fa8"
          icon={ArrowUpRight}
          idle={false}
          size={40}
        />
      </a>
    </main>
  );
};

export default CardPage;
