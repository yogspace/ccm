import {
  ArrowUpRight,
  Download,
  ImageDown,
  RotateCw,
  Share2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { trackEvent } from "../analytics";
import { cn } from "../cn";
import Button from "../components/button";
import {
  CARD_PICTURE_COLORS,
  paintCardPicture,
} from "../components/card-image";
import { Crumbs } from "../components/cookie-fx";
import CookieIcon from "../components/cookie-icon";
import RingText from "../components/ring-text";
import SiteFooter from "../components/site-footer";
import { cookieInButton } from "../components/styles";
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

/** A sprinkle bursting from behind the card (--angle, --color, --reach, --delay). */
const sprinkle =
  "absolute top-1/2 left-1/2 h-[0.95cqw] w-[2.4cqw] animate-[greet-sprinkle_1.4s_var(--ease-soft)_var(--delay,0.7s)_both] rounded-[1cqw] bg-(--color) opacity-0";

/**
 * A side of the card. The far side hides when the card stands on edge –
 * with the springy turn after about a sixth of it – and its canvas with it.
 * A long name is cut, it does not widen the card.
 */
const paper =
  "absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] rounded-[5.5cqw] bg-card-sheet px-[4.5cqw] py-[4cqw] text-card-ink shadow-[0_0.6rem_1.2rem_-0.4rem_rgb(4_8_60/0.35),0_2.8rem_4.5rem_-1.8rem_rgb(4_8_60/0.6)] backface-hidden [transition:visibility_0s_linear_0.17s]";

const springy = { type: "spring", stiffness: 520, damping: 26 } as const;

type BubbleProps = {
  shown: boolean;
  /** Seconds after it is shown before it pops up. */
  delay: number;
  /** What it says – a new key, new words. */
  say: { key: string; text: ReactNode };
  /** Tilted to this side (deg) – a new value swings it over, boing. */
  swing?: number;
};

/**
 * A speech bubble at the card's upper left corner (on phones, where the
 * stage runs out at the sides, above it): a sticker – a pill in the color of
 * the card's back with a white rim, its tail towards the card, a little
 * tilted and bobbing; clicks go through. It pops up `delay` after it is
 * shown and goes right away. New words spring in from below while the old
 * ones hop away, the bubble growing or shrinking along – and swinging over.
 */
const SpeechBubble = ({ shown, delay, say, swing = 0 }: BubbleProps) => {
  const clipId = useId();
  const motionless = still();
  const transition = motionless ? { duration: 0 } : springy;
  // The width the words need (with the padding), measured on a copy of them
  // – the bubble goes there in its own width, nothing in it is stretched.
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new words, a new width
  useLayoutEffect(() => {
    const copy = measureRef.current;
    if (!copy) return;
    const measure = () => setWidth(copy.offsetWidth);
    measure();
    // The font arriving, the stage changing size – the words too.
    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [say.key]);
  return (
    <small
      aria-hidden
      className="pointer-events-none invisible absolute right-[69%] bottom-[71%] z-1 origin-bottom-right animate-[eat-me_1.6s_ease-in-out_infinite] scale-50 -rotate-4 text-[3.8cqw] leading-none font-bold whitespace-nowrap text-card-deep opacity-0 [transition:opacity_0.25s_var(--ease-soft),scale_0.25s_var(--ease-soft),visibility_0s_linear_0.25s] motion-reduce:animate-none data-shown:visible data-shown:scale-100 data-shown:opacity-100 data-shown:[transition:opacity_0.3s_var(--ease-soft)_var(--bubble-delay),scale_0.55s_var(--ease-spring)_var(--bubble-delay),visibility_0s_linear_var(--bubble-delay)] max-xs:right-auto max-xs:bottom-[78%] max-xs:left-[21%]"
      data-shown={shown || undefined}
      style={{ "--bubble-delay": `${delay}s` } as CSSProperties}
    >
      <motion.span
        animate={{ rotate: swing }}
        className="relative block rounded-full border-[0.45cqw] border-white bg-card-back drop-shadow-[0_0.9cqw_1.4cqw_rgb(5_10_60/0.32)]"
        transition={
          motionless
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 7 }
        }
      >
        {/* The words – old and new in one place while they swap: the old
            ones hop away, the new spring in, both kept inside the bubble's
            round edge as it grows or shrinks. */}
        <motion.span
          animate={width === null ? undefined : { width }}
          // One column as wide as the bubble (not as the longest words), the
          // words centered in it even where they are wider – they run over
          // both sides alike and are cut there.
          className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[inherit] px-[3cqw] pt-[1.7cqw] pb-[1.8cqw] [justify-items:unsafe_center] *:col-start-1 *:row-start-1"
          initial={false}
          transition={transition}
        >
          <AnimatePresence initial={false}>
            <motion.span
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: "-90%", scale: 0.5, rotate: 10 }}
              initial={{ opacity: 0, y: "90%", scale: 0.5, rotate: -10 }}
              key={say.key}
              transition={transition}
            >
              {say.text}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <span
          className="invisible absolute top-0 left-0 px-[3cqw]"
          ref={measureRef}
        >
          {say.text}
        </span>
        {/* The tail, from the rim's inner edge: its fill covers the rim
            where it leaves the bubble, the white runs on along its two
            sides – cut off at the top, so none of it reaches into the
            bubble. 10 units are 1cqw: the rim is 4.5 wide. */}
        <svg
          aria-hidden
          className="absolute top-full right-[14%] h-[3.6cqw] w-[4.4cqw] overflow-visible fill-card-back stroke-white"
          viewBox="0 0 44 36"
        >
          <clipPath id={clipId}>
            <rect height="60" width="70" x="-10" y="0" />
          </clipPath>
          {/* The white first, the fill over it: only the outer half of the
              line shows – as wide as the rim. */}
          <path
            clipPath={`url(#${clipId})`}
            d="M2 0 Q22 30 40 33 Q30 20 26 0"
            fill="none"
            strokeLinejoin="round"
            strokeWidth="9"
          />
          <path d="M2 0 H26 Q30 20 40 33 Q22 30 2 0 Z" stroke="none" />
        </svg>
      </motion.span>
    </small>
  );
};

/**
 * A note while something is on its way (the cutter in front, the cookie on
 * the back): a spinning star and a line. Once it is there, the note stays a
 * moment (data-gone) and fades out softly while it appears in its place.
 */
const waiting =
  "col-start-1 row-start-1 grid min-h-0 place-items-center content-center gap-[0.6em] px-[8%] text-[3.4cqw] leading-[1.3] [transition:opacity_0.45s_var(--ease-soft),scale_0.45s_var(--ease-soft)] data-gone:pointer-events-none data-gone:scale-90 data-gone:opacity-0";

/** Like a label: the name left, the size (or how it is) right. */
const label =
  "flex items-baseline justify-between gap-[0.6em] px-[1.2cqw] text-left text-[4.6cqw] leading-[1.2] font-bold tracking-title";
const labelName = "min-w-0 truncate";
const labelNote = "flex-none text-[0.68em] font-semibold text-card-ink-muted";

/** The buttons below the card, on the page without a box. */
const action = "h-12 gap-2 rounded-xl pr-5 pl-3 text-body";
/** The main one: light; on phones across the whole row. */
const mainAction = cn(
  action,
  "bg-[#fffdf8] text-[#0d1033] hover:enabled:bg-white max-xs:col-span-full max-xs:h-10 max-xs:text-small"
);
/** The others: on phones side by side, each its cookie above its word. */
const sideAction = cn(
  action,
  "bg-white/14 text-on-page hover:enabled:bg-white/24 max-xs:h-auto max-xs:flex-col max-xs:gap-0 max-xs:px-1 max-xs:pt-1.5 max-xs:pb-1.5 max-xs:text-tiny"
);
const sideCookie = cn(cookieInButton, "max-xs:mx-0 max-xs:-mt-2 max-xs:-mb-2");

/**
 * The greeting card's page: who it is for, the card with the cutter in the
 * middle and the message running around it, who it is from – then the files
 * to print it, the way to make your own and the footer. One screen, no
 * scrolling. A click turns the card over: on its
 * back lies the cookie the cutter bakes.
 */
const CardPage = () => {
  const { t, i18n } = useTranslation();
  // The favorite color from the CMS by its number – unknown: the first.
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
  // The one on the back in the favorite color; those raining down stay
  // colorful.
  const cookie = useMemo(() => dough && { ...dough, glaze }, [dough, glaze]);
  const cardRef = useRef<HTMLDivElement>(null);
  /**
   * Bites out of the cookie on the back, where it was clicked – behind it
   * the message, more of it with every bite, until the cookie is gone.
   * Turned, a fresh one.
   */
  const [bites, setBites] = useState<Bite[]>([]);
  /** What the cookie says after a bite – another one each time. */
  const [yum, setYum] = useState("");
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
  /** “Baking your cookie” likewise, once the cookie lies on the back. */
  const [bakingShown, setBakingShown] = useState(true);
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

  // The page in the favorite color – set before the first paint already
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

  useEffect(() => {
    if (!cookie) {
      setBakingShown(true);
      return;
    }
    const timer = setTimeout(() => setBakingShown(false), 500);
    return () => clearTimeout(timer);
  }, [cookie]);

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

  /**
   * A sticker in the corner: this card turns over. In front it turns along
   * on hover – a hint; on the back it holds still while the cookie is
   * bitten – and is the way back until it is eaten up.
   */
  const turnSticker = (interactive: boolean) => (
    <span
      aria-hidden
      className="absolute top-[2.2cqw] right-[2.2cqw] grid cursor-pointer place-items-center"
      data-turn
    >
      <CookieIcon
        className="m-0 size-[8cqw]"
        icing="#2a44ff"
        icon={RotateCw}
        idle={false}
        interactive={interactive}
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
    const yums = t("card.yums")
      .split("|")
      .map((text) => text.trim())
      .filter((text) => text && text !== yum);
    setYum(yums[Math.floor(Math.random() * yums.length)] ?? "");
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

  // One screen without scrolling: who it is for, the card with the cutter
  // and the message running around it, who it is from, the files, the way to
  // the maker, the footer – room above and below the content (1fr). The
  // stage takes what is left, but never more than the width allows – any
  // room beyond that goes above and below, not between the lines. One
  // column, never wider than the screen – whatever is inside. Sizes follow
  // the screen's height, the card's insides follow the card (container
  // units). The card reaches into the safe areas.
  //
  // Phones: the card first and big – the stage wider than the screen, the
  // message running around goes out at the sides. The page scrolls on to
  // the buttons and the footer instead of squeezing the card into one
  // screen (index.css).
  //
  // Behind it all: light from behind the card, a neon glow rising from below.
  return (
    <main
      className="relative isolate grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto_minmax(0,min(100vw-2rem,38rem))_auto_auto_auto_1fr_auto] items-center justify-items-center gap-y-[clamp(0.3rem,1.5dvh,0.9rem)] overflow-hidden px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-center before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:bg-[radial-gradient(ellipse_55%_42%_at_50%_47%,rgb(255_255_255/0.2),transparent_72%),radial-gradient(ellipse_90%_55%_at_50%_118%,rgb(255_71_208/0.3),transparent_70%)] max-xs:h-auto max-xs:min-h-dvh max-xs:grid-rows-[1fr_auto_118vw_auto_auto_auto_1fr_auto]"
      data-greeting
    >
      {/* The card's own cookie, a few times in the background. */}
      {dough && <CardCookies shape={dough} />}
      {/* The rows above the cookies span the whole width, invisibly – they
          let clicks through to the cookies behind them; only the card (it
          turns over) and the buttons below take them. Who it is from and
          the buttons may be missing – their rows stay empty. */}
      <h1
        className="pointer-events-none row-start-2 mt-[clamp(0rem,1.5dvh,1rem)] max-w-full -rotate-2 animate-[greet-rise_0.9s_var(--ease-soft)_0.1s_both] text-[clamp(1.8rem,min(7.2dvh,150vw/(var(--chars,8)+2)),4.4rem)] leading-[1.05] font-bold tracking-tight wrap-anywhere embolden-25"
        // Long names get smaller instead of taking several lines.
        style={{ "--chars": heading.length } as CSSProperties}
      >
        {heading}
      </h1>

      {/* The stage is the largest square that fits the room left. Phones:
          wider than the screen – centred by hand, a grid puts what is wider
          than its cell at the start. */}
      <div className="pointer-events-none row-start-3 grid size-full min-h-0 place-items-center @container-size">
        <div
          className="pointer-events-none relative aspect-square w-[min(100cqw,100cqh,38rem)] @container max-xs:ml-[calc(50cqw-min(62.5cqw,50cqh))] max-xs:w-[min(125cqw,100cqh)] max-xs:justify-self-start"
          data-part="stage"
        >
          {/* The message, all the way around – slowly turning like a record. */}
          <RingText
            className="absolute inset-0 size-full animate-[ring-in_1.6s_var(--ease-soft)_0.45s_both,ring-turn_150s_linear_infinite] overflow-visible fill-on-page font-semibold whitespace-pre"
            text={greeting.message || t("card.ring")}
          />
          {greeting.message && <p className="sr-only">{greeting.message}</p>}
          {/* Sprinkles burst from behind the card as it lands. */}
          {!still() &&
            SPRINKLES.map(({ angle, color, reach }) => (
              <i
                aria-hidden
                className={sprinkle}
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
          {/* The cookie eaten up: confetti from behind the card – farther
              out, then drifting down as it fades. */}
          {eaten &&
            !still() &&
            CONFETTI.map(({ angle, color, reach, delay, size }) => (
              <i
                aria-hidden
                className={cn(
                  sprinkle,
                  "h-[calc(0.95cqw*var(--size,1))] w-[calc(2.4cqw*var(--size,1))] animate-[greet-confetti_2.4s_cubic-bezier(0.12,0.7,0.3,1)_var(--delay,0s)_both]"
                )}
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
          {/* The cutter speaks: “Turn me *click*” – once it stands on the
              card, until the card is turned for the first time. */}
          <SpeechBubble
            delay={1.4}
            say={{
              key: "turn",
              text: (
                <>
                  {t("card.turnMe")}{" "}
                  <em className="font-semibold">{t("card.click")}</em>
                </>
              ),
            }}
            shown={!!mesh && turns === 0}
          />
          {/* The cookie on the back speaks: “Eat me *click*” – once the card
              has turned, until the cookie is eaten (or the card turned
              back); after each bite something else (“Mmmh!”). */}
          <SpeechBubble
            delay={0.6}
            say={
              bites.length > 0 && yum
                ? { key: `yum-${bites.length}`, text: yum }
                : {
                    key: "eat",
                    text: (
                      <>
                        {t("card.eatMe")}{" "}
                        <em className="font-semibold">{t("card.click")}</em>
                      </>
                    ),
                  }
            }
            shown={flipped && !!cookie && !eaten}
            swing={bites.length % 2 === 0 ? 0 : 5}
          />
          {/* The card: tilted a little, leaning towards the pointer. */}
          <div
            className="pointer-events-auto absolute inset-[20.5%] animate-[card-land_1.1s_var(--ease-spring)_0.15s_both] transition-transform duration-900 transform-3d transform-[perspective(70rem)_rotateX(var(--lean-x,0deg))_rotateY(var(--lean-y,0deg))_rotate(-3deg)]"
            data-part="card"
            ref={cardRef}
          >
            {/* The card turns over: cutter in front, the cookie it bakes on
                the back. Once landed, it wobbles as if about to turn – a hint
                it can; on its own property (rotate), so the turn itself
                (transform) still transitions. */}
            <button
              aria-label={t(flipped ? "card.flipBack" : "card.flip")}
              aria-pressed={flipped}
              className="relative block size-full rounded-[5.5cqw] bg-transparent p-0 whitespace-normal text-inherit transform-3d [font:inherit] [text-align:inherit] [transition:transform_0.95s_var(--ease-spring)] not-disabled:not-data-flipped:animate-[greet-peek_1.4s_var(--ease-soft)_2.4s] focus-visible:outline-3 focus-visible:outline-offset-8 focus-visible:outline-on-page disabled:cursor-default disabled:opacity-100 data-held:cursor-default data-flipped:transform-[rotateY(180deg)]"
              data-flipped={flipped || undefined}
              // On the back a stray click (one beside the cookie, a quick
              // double tap) does not turn it back while there is cookie
              // left – only the sticker does, or the keyboard.
              data-held={(flipped && !eaten) || undefined}
              disabled={!hasShape}
              onClick={(event) => {
                const held = flipped && !eaten;
                const onSticker = (event.target as Element).closest(
                  "[data-turn]"
                );
                // detail 0: from the keyboard.
                if (held && event.detail > 0 && !onSticker) return;
                setTurns((count) => count + 1);
                // Turned before the cookie is baked: it bakes now – the
                // cutter's entrance in front is out of sight anyway.
                setBaked(true);
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
              <span className={cn(paper, "in-data-flipped:invisible")}>
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
                  // The cutter is there: out softly, while it grows up in the
                  // same place.
                  <span
                    aria-hidden={mesh ? true : undefined}
                    className={cn(waiting, "text-card-ink-muted")}
                    data-gone={mesh ? true : undefined}
                  >
                    <CookieIcon
                      className={cookieInButton}
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
                <span className={label} hidden={!hasShape}>
                  <span className={labelName}>{name}</span>
                  <small className={labelNote}>{sizeLabel}</small>
                </span>
                {hasShape && turnSticker(true)}
              </span>
              {/* The back in the favorite color, strong. Nothing on it gets
                  selected when the cookie is bitten in quick taps. */}
              <span
                className={cn(
                  paper,
                  "invisible bg-card-back select-none transform-[rotateY(180deg)] in-data-flipped:visible"
                )}
              >
                {/* The message, behind the cookie – each bite shows more: in
                    the back's color, a little darker – fine, but readable.
                    Smaller for longer messages – and so small that the
                    longest word fits the card's width (Pally's letters about
                    0.56em wide). */}
                <span
                  className="col-start-1 row-start-1 self-center px-[4cqw] text-center text-[clamp(5cqw,min(64cqw/(var(--chars,12)*0.24+3),42cqw/(var(--word,6)*0.56)),10cqw)] leading-[1.05] font-bold tracking-tight text-balance wrap-break-word text-card-back-ink"
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
                  // A click bites where it lands; the last bite eats it up and
                  // the greeting takes its place.
                  // biome-ignore lint/a11y/noStaticElementInteractions: a playful extra – the card itself turns by keyboard
                  // biome-ignore lint/a11y/useKeyWithClickEvents: as above
                  <span
                    className="col-start-1 row-start-1 grid min-h-0 cursor-pointer justify-items-center [transition:scale_0.35s_var(--ease-soft),opacity_0.35s_var(--ease-soft)] data-eaten:pointer-events-none data-eaten:scale-30 data-eaten:opacity-0"
                    data-eaten={eaten || undefined}
                    onClick={bite}
                    title={eaten ? undefined : t("card.bite")}
                  >
                    <CookieIcon
                      bites={bites.length > 0 ? bites : undefined}
                      className="m-0 aspect-square h-full min-h-0 w-auto justify-self-center"
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
                {/* Turned before it is baked: it bakes here, over the
                    message – nothing is given away before the first bite –
                    and goes like the note in front once the cookie is
                    there. */}
                {(!cookie || bakingShown) && (
                  <span
                    aria-hidden={cookie ? true : undefined}
                    className={cn(waiting, "bg-card-back text-card-back-ink")}
                    data-gone={cookie ? true : undefined}
                  >
                    <CookieIcon
                      className={cookieInButton}
                      idle={false}
                      interactive={false}
                      kind="star"
                      size={88}
                      spin
                    />
                    <span aria-live="polite">{t("card.baking")}</span>
                  </span>
                )}
                <span className={label}>
                  <span className={labelName}>{name}</span>
                  <small className={labelNote}>
                    {cookie && t(eaten ? "card.eaten" : "card.baked")}
                  </small>
                </span>
                {turnSticker(false)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {greeting.from && (
        <p
          className="pointer-events-none row-start-4 max-w-full -rotate-1 animate-[greet-rise_0.9s_var(--ease-soft)_0.65s_both] text-[clamp(1rem,min(3.3dvh,110vw/(var(--chars,8)+2)),1.7rem)] leading-[1.2] font-semibold text-on-page-muted wrap-anywhere"
          style={{ "--chars": greeting.from.length + 4 } as CSSProperties}
        >
          {t("card.fromName", { name: greeting.from })}
        </p>
      )}

      {/* Below the card, without a box – it is about the card: the files
          and the picture in a row, then the way to make your own. Phones:
          the 3MF across; STL, share and save side by side below it, each its
          cookie above its word. */}
      {(!failed || hasShape) && (
        <div
          className="row-start-5 mt-[clamp(0.2rem,1.2dvh,0.8rem)] flex animate-[greet-rise_0.9s_var(--ease-soft)_0.8s_both] flex-wrap justify-center gap-2.5 max-xs:grid max-xs:w-full max-xs:grid-cols-3 max-xs:gap-1.5 max-xs:[--cookie-scale:0.62]"
          data-part="actions"
        >
          {failed ? (
            <Button
              className={mainAction}
              onClick={() => setAttempt((count) => count + 1)}
              type="button"
            >
              <CookieIcon
                className={cookieInButton}
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
                className={mainAction}
                disabled={!mesh}
                onClick={() => save("3mf")}
                title={t("card.printHint")}
                type="button"
              >
                <CookieIcon
                  className={cookieInButton}
                  icing="#2a44ff"
                  icon={Download}
                  idle={false}
                  roll={12}
                  size={58}
                />
                {t("card.download")}
              </Button>
              <Button
                className={sideAction}
                disabled={!mesh}
                onClick={() => save("stl")}
                title={t("card.printHint")}
                type="button"
              >
                <CookieIcon
                  className={sideCookie}
                  icon={Download}
                  idle={false}
                  roll={-14}
                  size={58}
                />
                {t("card.stl")}
              </Button>
              <Button
                className={sideAction}
                disabled={!picture}
                onClick={sharePicture}
                title={t("card.pictureHint")}
                type="button"
              >
                <CookieIcon
                  className={sideCookie}
                  icing="#ff5fa8"
                  icon={Share2}
                  idle={false}
                  roll={10}
                  size={58}
                />
                {copied ? t("share.copied") : t("card.pictureShare")}
              </Button>
              <Button
                className={sideAction}
                disabled={!picture}
                onClick={savePicture}
                title={t("card.pictureHint")}
                type="button"
              >
                <CookieIcon
                  className={sideCookie}
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
      <a
        className="row-start-6 inline-flex animate-[greet-rise_0.9s_var(--ease-soft)_0.9s_both] items-center gap-1 rounded-xl bg-white/10 py-1 pr-1.5 pl-4 text-small font-bold text-on-page transition-[background-color] hover:bg-white/20"
        data-part="cta"
        href={`/${lang}`}
      >
        {t("card.makeOwn")}
        <CookieIcon
          icing="#ff5fa8"
          icon={ArrowUpRight}
          idle={false}
          size={40}
        />
      </a>

      {/* The editor's foot at the bottom – its line is the floor the cookies
          lie on. */}
      <SiteFooter
        className="relative row-start-8 mt-1.5 animate-[greet-rise_0.9s_var(--ease-soft)_1s_both] justify-self-stretch"
        compact
      />
      {crumbs.map((crumb) => (
        <Crumbs at={crumb} key={crumb.id} seed={Math.floor(crumb.id)} />
      ))}
    </main>
  );
};

export default CardPage;
