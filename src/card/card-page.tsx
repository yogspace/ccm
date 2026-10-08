import {
  ArrowUpLeft,
  ArrowUpRight,
  Download,
  ImageDown,
  RotateCw,
  Share2,
} from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../analytics";
import Button from "../components/button";
import {
  CARD_PICTURE_COLORS,
  paintCardPicture,
} from "../components/card-image";
import { Crumbs } from "../components/cookie-fx";
import CookieIcon from "../components/cookie-icon";
import RingText from "../components/ring-text";
import SiteFooter from "../components/site-footer";
import { cookieSeed } from "../cookie-jar";
import {
  type Bite,
  biteAt,
  cookieAt,
  cookieLeft,
  cookieOutline,
  leftoverCrumbs,
} from "../cookies/models";
import { download } from "../export/download";
import { fileBase } from "../export/file-name";
import { toStl } from "../export/stl";
import { toThreeMf } from "../export/three-mf";
import { resolveColors, setPageGlaze } from "../glaze";
import { readGreeting } from "../greeting";
import { renderMeshTop } from "../render-top";
import { useCardColor } from "../site-context";
import { formatLength, initialUnit } from "../units";
import { isEmptyDrawing, readHash } from "../url-state";
import CardCookies from "./card-cookies";
import CardCutter from "./card-cutter";
import { loadCutter } from "./load-cutter";

const hash = window.location.hash;
const shared = readHash(hash);
const greeting = readGreeting(hash);
const hasShape = shared.rings.length > 0 || !isEmptyDrawing(shared.drawing);

/** A few sprinkles that burst out from behind the card – as it lands, and on every turn. */
const SPRINKLES = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * 360 + (i % 2 ? 11 : -7),
  color: ["#ff5fa8", "#ffffff", "#ffc31f", "#ff6a1f", "#5fb36b"][i % 5],
  reach: 34 + (i % 3) * 5,
}));

/**
 * Confetti from behind the card once the cookie is eaten up – like the
 * sprinkles, but more of it, flying farther, a little apart in time.
 */
const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  angle: (i / 40) * 360 + ((i * 37) % 17) - 8,
  color: ["#ff5fa8", "#ffffff", "#ffc31f", "#ff6a1f", "#5fb36b", "#a9b6ff"][
    i % 6
  ],
  reach: 52 + ((i * 53) % 34),
  delay: ((i * 29) % 12) * 0.02,
  size: 0.8 + ((i * 31) % 7) / 10,
}));

/** Pause (ms) before painting the picture – the card lands first. */
const PICTURE_DELAY = 1500;

/** How the cookie on the back lies: tilted back this far (rad). */
const BACK_TILT = -0.5;

/**
 * Where a click goes through the cookie on the back, in cookie units: the
 * ray from the renderer's camera (28°, at 5.4 – cookies/renderer.ts) met
 * at its top, through its thickness down to its bottom – the cookie lies
 * tilted back by BACK_TILT, so its front edge shows too. `x`, `y`: the
 * click in the canvas's own pixels – the card's lean and turn undone.
 */
const throughCookie = (x: number, y: number, canvas: HTMLCanvasElement) => {
  const u = (x / canvas.offsetWidth) * 2 - 1;
  const v = 1 - (y / canvas.offsetHeight) * 2;
  const spread = Math.tan((14 * Math.PI) / 180);
  // Camera and ray turned into the cookie's own frame (the tilt undone).
  const a = -BACK_TILT;
  const turn = (py: number, pz: number) => [
    py * Math.cos(a) - pz * Math.sin(a),
    py * Math.sin(a) + pz * Math.cos(a),
  ];
  const [oy, oz] = turn(0, 5.4);
  const [dy, dz] = turn(v * spread, -1);
  // The dough's top and bottom (models.ts: DEPTH with its bevel).
  return [0.26, 0.16, 0.06, -0.04, -0.1].map((z) => {
    const t = (z - oz) / dz;
    return { x: u * spread * t, y: oy + dy * t };
  });
};

/**
 * Close to the edge still counts: rings around the click (cookie units) –
 * its rounded, tilted edge shows a little wider than its outline.
 */
const NEAR_EDGE = [0.05, 0.1, 0.16];

const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The greeting card's page: who it is for, the card with the cutter in the
 * middle and the message running around it, who it is from – then the files
 * to print it, the way to make your own and the footer. One screen, no
 * scrolling. A click turns the card over: on its
 * back lies the cookie the cutter bakes.
 */
const CardPage = () => {
  const { t, i18n } = useTranslation();
  // The favourite colour from the CMS by its number – unknown: the first.
  // The page in its scheme, the cutter and the cookie's icing in it.
  const { glaze } = useCardColor(greeting.color);
  const [cutter, setCutter] =
    useState<Awaited<ReturnType<typeof loadCutter>>>(null);
  const [failed, setFailed] = useState(!hasShape);
  /** Counts the tries – “Try again” starts another. */
  const [attempt, setAttempt] = useState(0);
  /** Turned over: the cookie side up. Every turn bursts sprinkles again. */
  const [turns, setTurns] = useState(0);
  const flipped = turns % 2 === 1;
  const mesh = cutter?.mesh ?? null;
  /**
   * The cookies – on the back, raining down – are baked once the cutter has
   * grown: baking them all at once would make its entrance stutter.
   */
  const [baked, setBaked] = useState(false);
  const dough = useMemo(
    () =>
      cutter && baked
        ? {
            dough: cutter.outline,
            icing: cutter.icing,
            seed: cookieSeed(cutter.outline),
          }
        : null,
    [cutter, baked]
  );
  // The one on the back in the favourite colour; those raining down stay
  // colourful.
  const cookie = useMemo(() => dough && { ...dough, glaze }, [dough, glaze]);
  const cardRef = useRef<HTMLDivElement>(null);
  /**
   * Bites out of the cookie on the back, where it was clicked – behind it
   * the message, more of it with every bite, until the cookie is gone.
   * Turned, a fresh one.
   */
  const [bites, setBites] = useState<Bite[]>([]);
  /**
   * Bites are worked out one after another – quick taps don't race; the
   * latest list lives here, ahead of the next render.
   */
  const biting = useRef(Promise.resolve());
  const bitesNow = useRef<Bite[]>([]);
  const outline = useMemo(
    () => (cookie ? cookieOutline(cookie) : []),
    [cookie]
  );
  const eaten = useMemo(
    () => bites.length > 0 && !cookieLeft(outline, bites),
    [outline, bites]
  );
  const [crumbs, setCrumbs] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const name = shared.name.trim() || "Cookie Cutter";
  const lang = i18n.resolvedLanguage ?? "en";
  const unit = initialUnit();
  /** The message behind the cookie on the back. */
  const hidden = greeting.message || t("card.ring");
  const heading = greeting.to
    ? t("card.for", { name: greeting.to })
    : t("card.forYou");
  const sizeLabel = formatLength(
    shared.params.size,
    unit,
    lang,
    unit === "in" ? 1 : 0
  );
  /**
   * “Shaping your cutter” stays a moment once the cutter is there – fading
   * out while the cutter grows up out of the card.
   */
  const [waitShown, setWaitShown] = useState(true);
  /** The card as a picture, painted ahead: Safari only shares right in the click. */
  const [picture, setPicture] = useState<File | null>(null);

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

  // Paint the picture once the cutter is there – after the card has landed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: painted once per cutter
  useEffect(() => {
    if (!mesh) return;
    let current = true;
    const timer = setTimeout(async () => {
      const cutterView = renderMeshTop(mesh, glaze, 900, 788);
      const blob = await paintCardPicture({
        colors: resolveColors(document.body, CARD_PICTURE_COLORS),
        cutter: cutterView,
        heading,
        from: greeting.from ? t("card.fromName", { name: greeting.from }) : "",
        ring: greeting.message || t("card.ring"),
        name,
        size: sizeLabel,
        site: "ccm.mxwr.de",
      });
      if (cutterView) cutterView.width = cutterView.height = 0;
      if (!current || !blob) return;
      const file = `${fileBase(name, shared.params.size)}-${t("card.fileSuffix")}.png`;
      setPicture(new File([blob], file, { type: "image/png" }));
    }, PICTURE_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [mesh, t]);

  // The page in the favourite colour – set before the first paint already
  // (glaze.ts), kept while the card is open; the browser's bar along.
  useEffect(() => {
    setPageGlaze(glaze);
    const page = getComputedStyle(document.body).backgroundColor;
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      meta.content = page;
    }
    return () => setPageGlaze(null);
  }, [glaze]);

  useEffect(() => {
    if (!mesh) {
      setWaitShown(true);
      setBaked(false);
      return;
    }
    const timers = [
      setTimeout(() => setWaitShown(false), 500),
      setTimeout(() => setBaked(true), 1300),
    ];
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [mesh]);

  const [copied, setCopied] = useState(false);

  // The picture with the card's link, the link on its own line. Some apps
  // take only the picture and drop the text – so it goes on the clipboard as
  // well (both right in the click, before the permission for it expires).
  // Where files can't be shared, just the link; without a share menu at all,
  // the link is copied.
  const sharePicture = () => {
    const url = window.location.href;
    const text = `${heading}\n${url}`;
    trackEvent("card-picture");
    const failed = (error: unknown) => {
      // Cancelling the share menu is not an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    };
    if (picture && navigator.canShare?.({ files: [picture], text })) {
      navigator.clipboard?.writeText(text).catch(() => undefined);
      navigator.share({ files: [picture], title: heading, text }).catch(failed);
    } else if (typeof navigator.share === "function") {
      navigator.share({ title: heading, url }).catch(failed);
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => window.prompt(t("share.copy"), url));
    }
  };

  const savePicture = () => {
    if (!picture) return;
    trackEvent("card-picture");
    download(picture, picture.name);
  };

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

  // The card leans towards the pointer, as if held in the hand – the front
  // only: on the back it holds still, so a bite lands where it is aimed.
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  useEffect(() => {
    const card = cardRef.current;
    if (!card || still()) return;
    const rest = () => {
      card.style.removeProperty("--lean-x");
      card.style.removeProperty("--lean-y");
    };
    const lean = (event: PointerEvent) => {
      if (flippedRef.current) {
        rest();
        return;
      }
      const { left, top, width, height } = card.getBoundingClientRect();
      const x = (event.clientX - (left + width / 2)) / window.innerWidth;
      const y = (event.clientY - (top + height / 2)) / window.innerHeight;
      card.style.setProperty("--lean-x", `${(-y * 16).toFixed(2)}deg`);
      card.style.setProperty("--lean-y", `${(x * 20).toFixed(2)}deg`);
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

  // A bite right where it is clicked – instead of turning the card. Next
  // to the cookie, or where it is eaten already, nothing.
  const bite = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const area = event.currentTarget;
    const canvas = area.querySelector("canvas");
    if (eaten || !canvas) return;
    // offsetX/Y: in the area's own frame, the card's lean and turn undone;
    // the canvas sits in it at its layout place.
    const ray = throughCookie(
      event.nativeEvent.offsetX - (canvas.offsetLeft - area.offsetLeft),
      event.nativeEvent.offsetY - (canvas.offsetTop - area.offsetTop),
      canvas
    );
    // The first bit of cookie along the ray – or the nearest beside it, at
    // its top or at its bottom (the front edge).
    const around = NEAR_EDGE.flatMap((reach) =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return [ray[0], ray[ray.length - 1]].map((point) => ({
          x: point.x + Math.cos(angle) * reach,
          y: point.y + Math.sin(angle) * reach,
        }));
      }).flat()
    );
    const hit = [...ray, ...around].find(({ x, y }) =>
      cookieAt(outline, bitesNow.current, x, y)
    );
    if (!hit) return;
    const bitten = biteAt(hit.x, hit.y);
    const shape = cookie;
    if (!shape) return;
    biting.current = biting.current.then(async () => {
      // Bits too small to keep go along with the bite.
      const next = [...bitesNow.current, bitten];
      const crumbs = await leftoverCrumbs(shape, next).catch(() => []);
      const final = crumbs.length > 0 ? [...next, crumbs] : next;
      bitesNow.current = final;
      setBites(final);
      if (!cookieLeft(outline, final)) trackEvent("card-eaten");
    });
    const crumb = { id: performance.now(), x: event.clientX, y: event.clientY };
    setCrumbs((previous) => [...previous, crumb]);
    setTimeout(
      () => setCrumbs((previous) => previous.filter((c) => c !== crumb)),
      900
    );
  };

  const save = (format: "3mf" | "stl") => {
    if (!mesh) return;
    const file = `${fileBase(name, shared.params.size)}.${format}`;
    download(format === "3mf" ? toThreeMf(mesh, name) : toStl(mesh), file);
    trackEvent(format === "3mf" ? "card-download-3mf" : "card-download-stl");
  };

  return (
    <main className="greeting">
      {/* The card's own cookie, a few times in the background. */}
      {dough && <CardCookies shape={dough} />}
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
          {eaten &&
            !still() &&
            CONFETTI.map(({ angle, color, reach, delay, size }) => (
              <i
                aria-hidden
                className="greeting-sprinkle greeting-confetti"
                key={`eaten-${angle}`}
                style={
                  {
                    "--angle": `${angle}deg`,
                    "--color": color,
                    "--reach": `${reach}cqw`,
                    "--delay": `${delay}s`,
                    "--size": size,
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
              onClick={() => {
                setTurns((count) => count + 1);
                // Turned to the back: a fresh cookie – set while the back is
                // still hidden, so a bitten one never vanishes in view.
                if (!flipped) {
                  bitesNow.current = [];
                  setBites([]);
                }
                if (turns === 0) trackEvent("card-turned");
              }}
              type="button"
            >
              <span className="greeting-paper greeting-front">
                {mesh && (
                  <CardCutter
                    color={glaze}
                    delay={250}
                    label={t("card.cutterAlt", { name })}
                    mesh={mesh}
                    paused={flipped}
                  />
                )}
                {(!mesh || waitShown) && (
                  <span
                    aria-hidden={mesh ? true : undefined}
                    className="greeting-wait"
                    data-gone={mesh ? true : undefined}
                  >
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
                  <small>{sizeLabel}</small>
                </span>
                {cookie && turnSticker}
              </span>
              <span className="greeting-paper greeting-back">
                {/* The message, behind the cookie – each bite shows more. */}
                <span
                  className="greeting-hidden"
                  style={
                    {
                      "--chars": hidden.length,
                      // Its longest word fits a line – not broken apart.
                      "--word": Math.max(
                        ...hidden.split(/\s+/).map((word) => word.length)
                      ),
                    } as CSSProperties
                  }
                >
                  {hidden}
                </span>
                {cookie && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: a playful extra – the card itself turns by keyboard
                  // biome-ignore lint/a11y/useKeyWithClickEvents: as above
                  <span
                    className="greeting-bite"
                    data-eaten={eaten || undefined}
                    onClick={bite}
                    title={eaten ? undefined : t("card.bite")}
                  >
                    <CookieIcon
                      bites={bites.length > 0 ? bites : undefined}
                      className="greeting-cookie"
                      // Baked, it is simply there – fresh again too.
                      grown
                      // Still: drawn once, no frames while it lies there.
                      idle={false}
                      interactive={false}
                      shape={cookie}
                      size={320}
                      tilt={BACK_TILT}
                    />
                  </span>
                )}
                {/* Until the first bite: an arrow to the cookie – floating,
                    clicks go through, nothing moves when it goes. */}
                <small
                  aria-hidden
                  className="greeting-eat-me"
                  data-gone={bites.length > 0 || undefined}
                  // Fades in anew after every turn, once the card has landed.
                  key={turns}
                >
                  <CookieIcon
                    className="greeting-eat-arrow"
                    icing="#ff5fa8"
                    icon={ArrowUpLeft}
                    idle={false}
                    interactive={false}
                    size={44}
                  />
                  <span>
                    {t("card.eatMe")} <em>{t("card.click")}</em>
                  </span>
                </small>
                <span className="greeting-name">
                  <span>{name}</span>
                  <small>{t(eaten ? "card.eaten" : "card.baked")}</small>
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

      {/* Below the card, without a box – it is about the card: the files
          and the picture in a row, then the way to make your own. */}
      {(!failed || hasShape) && (
        <div className="greeting-actions">
          {failed ? (
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
          ) : (
            <>
              <Button
                className="primary"
                disabled={!mesh}
                onClick={() => save("3mf")}
                title={t("card.printHint")}
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
              <Button
                disabled={!mesh}
                onClick={() => save("stl")}
                title={t("card.printHint")}
                type="button"
              >
                <CookieIcon icon={Download} idle={false} roll={-14} size={58} />
                {t("card.stl")}
              </Button>
              <Button
                disabled={!picture}
                onClick={sharePicture}
                title={t("card.pictureHint")}
                type="button"
              >
                <CookieIcon
                  icing="#ff5fa8"
                  icon={Share2}
                  idle={false}
                  roll={10}
                  size={58}
                />
                {copied ? t("share.copied") : t("card.pictureShare")}
              </Button>
              <Button
                disabled={!picture}
                onClick={savePicture}
                title={t("card.pictureHint")}
                type="button"
              >
                <CookieIcon
                  icing="#ffc31f"
                  icon={ImageDown}
                  idle={false}
                  roll={-8}
                  size={58}
                />
                {t("card.pictureSave")}
              </Button>
            </>
          )}
        </div>
      )}
      <a className="greeting-cta" href={`/${lang}`}>
        {t("card.makeOwn")}
        <CookieIcon
          icing="#ff5fa8"
          icon={ArrowUpRight}
          idle={false}
          size={40}
        />
      </a>

      <SiteFooter />
      {crumbs.map((crumb) => (
        <Crumbs at={crumb} key={crumb.id} seed={Math.floor(crumb.id)} />
      ))}
    </main>
  );
};

export default CardPage;
