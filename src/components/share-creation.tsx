import { ArrowRight, Check, Copy, Download, Gift, Share2 } from "lucide-react";
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { trackEvent } from "../analytics";
import { cn } from "../cn";
import { download } from "../export/download";
import { resolveColors } from "../glaze";
import type { Greeting } from "../greeting";
import { useCardColor } from "../site-context";
import { creationUrl, store } from "../store";
import Button from "./button";
import CanvasView from "./canvas-view";
import { Card, CardHead, CardTitle } from "./card";
import CardComposer from "./card-composer";
import { truncate } from "./card-image";
import ColorSwatches from "./color-swatches";
import CookieIcon from "./cookie-icon";
import type { PreviewHandle } from "./preview-3d";
import RingText from "./ring-text";
import Segmented from "./segmented";
import {
  cookieInButton,
  ghost,
  ringOnGlaze,
  shareContent,
  shareIntro,
  shareLink,
  shareMore,
  shareUrl,
  shareVisual,
} from "./styles";
import { useGrow } from "./use-grow";
import { useLivePicture } from "./use-live-picture";

type Props = {
  /** The 3D view – it renders the picture from above. */
  preview: RefObject<PreviewHandle | null>;
};

const SIZE = 1200;
const MARGIN = 60;
const CARD = { x: MARGIN, y: MARGIN, w: SIZE - 2 * MARGIN, h: 880 };
/** Where it was made – at the picture's foot. */
const SITE_LINE = "Cookie Cutter Maker · ccm.mxwr.de";
const FONT = '"Pally", system-ui, sans-serif';

/** The favourite colour's shades the picture is painted in (glaze.css). */
const PICTURE_COLORS = {
  page: "--glaze",
  sheet: "--card-sheet",
  text: "--on-glaze",
  muted: "--on-glaze-muted",
} as const;

/**
 * The share picture, painted only when it is saved or shared – as the box
 * shows it (built of the page, below): the favourite colour, the card with
 * the cutter from above, below it the name and where it was made.
 */
const paintPicture = async (
  cutter: HTMLCanvasElement,
  name: string,
  colors: Record<keyof typeof PICTURE_COLORS, string>
) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = colors.sheet;
  ctx.beginPath();
  ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, 48);
  ctx.fill();
  // Right away – a newer cutter may take this one's place meanwhile.
  ctx.drawImage(cutter, CARD.x, CARD.y, CARD.w, CARD.h);

  await document.fonts.load(`700 1em ${FONT}`).catch(() => undefined);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.text;
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(truncate(ctx, name, CARD.w), MARGIN, CARD.y + CARD.h + 120);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText(SITE_LINE, MARGIN, SIZE - 70, CARD.w);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  // Freed right away: iOS Safari's canvas memory is tight and freed late.
  canvas.width = canvas.height = 0;
  return blob;
};

type Mode = "picture" | "card";

/** The picture painted for what the box showed – kept until that changes. */
type Painted = {
  cutter: HTMLCanvasElement;
  key: string;
  file: Promise<File | null>;
};

/**
 * “Share creation”: one box below the editor, only what is needed. As a
 * picture: the picture as it will be shared – built by the page, painted
 * only once it is saved or shared – in the favourite colour, the link (a
 * click copies it), sharing and saving the picture. As a greeting card: the
 * little card with the message around the cutter, the fields beside it –
 * and the box grows along. The colour is the same for both.
 */
const ShareCreation = ({ preview }: Props) => {
  const { t } = useTranslation();
  const { cutter, name } = useSnapshot(store);
  const boxRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const painted = useRef<Painted | null>(null);
  const [mode, setMode] = useState<Mode>("picture");
  // Kept while switching back and forth – its colour for the picture too.
  const [greeting, setGreeting] = useState<Greeting>({
    to: "",
    from: "",
    message: "",
    // The first favourite colour – the default.
    color: 0,
  });
  const { chosen, glaze } = useCardColor(greeting.color);
  const [copied, setCopied] = useState(false);
  /** After “Share image”: a note that text and link were copied too. */
  const [textCopied, setTextCopied] = useState(false);
  const title = name.trim() || "Cookie Cutter Maker";
  const pictureName = name.trim() || "Cookie Cutter";
  const url = creationUrl();
  useGrow(boxRef, bodyRef);

  // The cutter from above in the favourite colour, for the picture and the
  // little card alike: anew shortly after drawing, right away for a colour.
  const cutterView = useLivePicture<HTMLCanvasElement>(
    boxRef,
    [cutter.mesh],
    () => preview.current?.renderTop(CARD.w, CARD.h, glaze) ?? null,
    {
      quick: [glaze],
      // Freed once the next has faded in over it (canvas-view.tsx).
      release: (canvas) => {
        setTimeout(() => {
          canvas.width = canvas.height = 0;
        }, 1000);
      },
    }
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  /**
   * The picture as a file, for what the box shows – painted on the first
   * press (it starts on pointer down already), kept while nothing changes.
   */
  const pictureFile = () => {
    const place = pictureRef.current;
    if (!(cutterView && place)) return Promise.resolve(null);
    const key = `${glaze}\n${pictureName}`;
    const last = painted.current;
    if (last?.cutter === cutterView && last.key === key) return last.file;
    const fileName = `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
    const file = paintPicture(
      cutterView,
      pictureName,
      resolveColors(place, PICTURE_COLORS)
    ).then((blob) => blob && new File([blob], fileName, { type: "image/png" }));
    painted.current = { cutter: cutterView, key, file };
    return file;
  };

  const copy = async () => {
    trackEvent("share-link");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t("share.copy"), url);
    }
  };

  const shareImage = async () => {
    trackEvent("share-image");
    // The link on its own line, so it does not stick to the text.
    const text = `${t("share.text")}\n${url}`;
    // Some apps (e.g. Signal) take only the image and drop the text – so it is
    // on the clipboard as well, link included. Called right in the click,
    // the share menu as soon as the picture is painted – both before the
    // permission for them expires.
    navigator.clipboard
      ?.writeText(text)
      .then(() => setTextCopied(true))
      .catch(() => undefined);
    const file = await pictureFile();
    if (!file) return;
    navigator.share({ files: [file], title, text }).catch((error: unknown) => {
      // Cancelling the share menu is not an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    });
  };

  const saveImage = async () => {
    const file = await pictureFile();
    if (!file) return;
    download(file, file.name);
    trackEvent("save-image");
  };

  // Whether pictures can be shared at all – asked with a stand-in.
  const canShareImage = useMemo(
    () =>
      !!navigator.canShare?.({
        files: [new File([], "cookie.png", { type: "image/png" })],
        text: url,
      }),
    [url]
  );

  // In front of the fan's lower edge (editor-app.tsx); the box only holds its
  // content, with the content's own gaps – it grows along (use-grow.ts).
  return (
    <Card
      className="relative z-10 mt-[calc(var(--fan-card)*-0.45)] block w-[min(100%,52rem)] self-center"
      ref={boxRef}
    >
      <div className="flex flex-col gap-4" ref={bodyRef}>
        <CardHead className="flex-wrap">
          <CardTitle>{t("share.creation")}</CardTitle>
          <Segmented
            label={t("share.creation")}
            onChange={setMode}
            options={[
              { value: "picture", label: t("share.asPicture") },
              { value: "card", label: t("share.asCard") },
            ]}
            tone="card"
            value={mode}
          />
        </CardHead>
        {/* The picture on the left, the rest beside it; on phones above. */}
        <div className="grid grid-cols-[16rem_minmax(0,1fr)] items-stretch gap-6 max-sm:grid-cols-1">
          {mode === "card" ? (
            <CardComposer
              greeting={greeting}
              onChange={setGreeting}
              picture={cutterView}
            />
          ) : (
            <>
              {/* The picture as it will be shared, built of the page itself –
                  paintPicture paints it the same, 1200 px wide: 12 px there
                  are 1cqw here. The cutter's place is kept while it renders.
                  Name and site on the baselines they are painted on (1060
                  and 1130) – Pally's lies --baseline below the top of a line
                  as high as its font. */}
              <div
                aria-label={t("share.imageAlt", { name: title })}
                className={cn(
                  shareVisual,
                  "glaze relative overflow-hidden rounded-2xl bg-glaze text-on-glaze @container"
                )}
                ref={pictureRef}
                role="img"
                style={{ "--glaze": glaze } as CSSProperties}
              >
                <div
                  className={cn(
                    "absolute top-[5cqw] left-[5cqw] h-[73.333cqw] w-[90cqw] rounded-[4cqw] bg-card-sheet",
                    !cutterView && cutter.mesh && ghost
                  )}
                >
                  {cutterView && (
                    <CanvasView canvas={cutterView} className="size-full" />
                  )}
                </div>
                <strong className="absolute top-[calc(88.333cqw-var(--baseline))] left-[5cqw] w-[90cqw] truncate text-[6.333cqw] leading-none font-bold [--baseline:0.813em]">
                  {pictureName}
                </strong>
                <small className="absolute top-[calc(94.167cqw-var(--baseline))] left-[5cqw] w-[90cqw] truncate text-[3.167cqw] leading-none font-medium text-on-glaze-muted [--baseline:0.813em]">
                  {SITE_LINE}
                </small>
              </div>
              <div className={shareContent}>
                <p className={shareIntro}>{t("share.creationText")}</p>
                <ColorSwatches
                  onChange={(color) => setGreeting({ ...greeting, color })}
                  value={chosen}
                />
                {/* The other way to share, right where it is seen – with the
                    card page in miniature, a taste of what it becomes: the
                    ring of words turning, the gift on a little card – beside
                    the invitation, an arrow to follow. */}
                <Button
                  className="group/invite h-auto justify-start gap-3.5 rounded-2xl bg-[color-mix(in_oklab,#ffc31f_24%,var(--color-surface))] py-2.5 pr-3.5 pl-2.5 text-left whitespace-normal text-ink hover:enabled:bg-[color-mix(in_oklab,#ffc31f_36%,var(--color-surface))]"
                  onClick={() => setMode("card")}
                  type="button"
                >
                  <span
                    aria-hidden
                    className="glaze relative aspect-square w-18 flex-none -rotate-4 overflow-hidden rounded-xl bg-glaze shadow-[0_0.45rem_0.9rem_-0.35rem_rgb(4_8_60/0.5)] [transition:--glaze_0.5s_var(--ease-soft),rotate_0.4s_var(--ease-spring),scale_0.4s_var(--ease-spring)] group-hover/invite:scale-106 group-hover/invite:rotate-3"
                    style={{ "--glaze": glaze } as CSSProperties}
                  >
                    <RingText
                      className={cn(
                        ringOnGlaze,
                        "animate-[ring-turn_40s_linear_infinite]"
                      )}
                      text={t("card.ring")}
                    />
                    <span className="absolute inset-1/4 grid -rotate-3 place-items-center rounded-md bg-card-sheet">
                      <CookieIcon
                        className="m-0 [--cookie-scale:0.72]"
                        icing="#ffc31f"
                        icon={Gift}
                        idle={false}
                        roll={-10}
                        size={44}
                      />
                    </span>
                  </span>
                  <span className="grid flex-1 gap-px">
                    <strong>{t("share.cardInvite")}</strong>
                    <small className="text-small font-medium text-muted">
                      {t("share.cardInviteHint")}
                    </small>
                  </span>
                  <CookieIcon
                    className="-mx-1 -my-2 transition-[translate] duration-350 ease-spring group-hover/invite:translate-x-1"
                    icing="#ff5fa8"
                    icon={ArrowRight}
                    idle={false}
                    size={40}
                  />
                </Button>
                {/* The link itself is the button: a click copies it. */}
                <Button
                  aria-label={copied ? t("share.copied") : t("share.copy")}
                  className={shareLink}
                  data-copied={copied || undefined}
                  disabled={!cutter.mesh}
                  onClick={copy}
                  title={t("share.copy")}
                  type="button"
                >
                  <span aria-live="polite" className={shareUrl}>
                    {copied ? t("share.copied") : url}
                  </span>
                  {copied ? (
                    <CookieIcon
                      className={cookieInButton}
                      icing="#00b86b"
                      icon={Check}
                      key="ok"
                      size={44}
                    />
                  ) : (
                    <CookieIcon
                      className={cookieInButton}
                      icing="#2a44ff"
                      icon={Copy}
                      key="copy"
                      size={44}
                    />
                  )}
                </Button>
                <div className={shareMore}>
                  <Button
                    disabled={!cutterView}
                    kind={canShareImage ? undefined : "primary"}
                    onClick={saveImage}
                    onPointerDown={() => pictureFile()}
                    type="button"
                  >
                    <CookieIcon
                      className={cookieInButton}
                      icing="#2a44ff"
                      icon={Download}
                      roll={-12}
                      size={48}
                    />
                    {t("share.saveImage")}
                  </Button>
                  {canShareImage && (
                    <Button
                      disabled={!cutterView}
                      kind="primary"
                      onClick={shareImage}
                      onPointerDown={() => pictureFile()}
                      type="button"
                    >
                      <CookieIcon
                        className={cookieInButton}
                        icing="#ff5fa8"
                        icon={Share2}
                        roll={10}
                        size={48}
                      />
                      {t("share.share")}
                    </Button>
                  )}
                </div>
                {textCopied && (
                  <p className="mt-3 text-small text-muted">
                    {t("share.textCopied")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ShareCreation;
