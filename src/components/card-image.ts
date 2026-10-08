import { RING_RADIUS, ringLayout } from "./ring-text";

/** Where it was made – at the share picture's foot. */
export const SITE_LINE = "Cookie Cutter Maker · ccm.mxwr.de";

/** The share picture: square, the card with the cutter in its upper part. */
const SHARE_SIZE = 1200;
const SHARE_MARGIN = 60;
/** The cutter's place on the share picture – render it at this size. */
export const SHARE_CARD = {
  x: SHARE_MARGIN,
  y: SHARE_MARGIN,
  w: SHARE_SIZE - 2 * SHARE_MARGIN,
  h: 880,
};

/** The favourite colour's shades the share picture is painted in (glaze.css). */
export const SHARE_PICTURE_COLORS = {
  page: "--glaze",
  sheet: "--card-sheet",
  text: "--on-glaze",
  muted: "--on-glaze-muted",
} as const;

/** The greeting card as a picture – portrait 4:5, as Instagram likes it. */
const WIDTH = 1080;
const HEIGHT = 1350;
const FONT = '"Pally", system-ui, sans-serif';

/**
 * The card's favourite colour and its shades, as the page shows them
 * (index.css, read with resolveColors – glaze.ts).
 */
export const CARD_PICTURE_COLORS = {
  page: "--glaze",
  onPage: "--on-glaze",
  onPageMuted: "--on-glaze-muted",
  sheet: "--card-sheet",
  ink: "--card-ink",
  inkMuted: "--card-ink-muted",
} as const;

export type CardPicture = {
  colors: Record<keyof typeof CARD_PICTURE_COLORS, string>;
  /** The cutter from above on a transparent background. */
  cutter: HTMLCanvasElement | null;
  /** “For Carla” */
  heading: string;
  /** “from Max”, or empty */
  from: string;
  /** What runs around the card. */
  ring: string;
  name: string;
  /** The size, formatted (“128 mm”). */
  size: string;
  site: string;
};

const glow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

/** Shrinks the font until the text fits `width`; returns the size. */
const fitFont = (
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  width: number
) => {
  let fitted = size;
  ctx.font = `${weight} ${fitted}px ${FONT}`;
  while (fitted > 24 && ctx.measureText(text).width > width) {
    fitted -= 2;
    ctx.font = `${weight} ${fitted}px ${FONT}`;
  }
  return fitted;
};

/** A line of text cut with “…” where it does not fit. */
export const truncate = (
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
) => {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
};

/**
 * The share picture, painted when it is saved or shared – as the page builds
 * it (share-picture.tsx): the favourite colour, the card with the cutter from
 * above, below it the name and where it was made. Also the admin's preview
 * of a gallery card (fields/gallery-builder.tsx).
 */
export const paintSharePicture = async (
  cutter: HTMLCanvasElement,
  name: string,
  colors: Record<keyof typeof SHARE_PICTURE_COLORS, string>
) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SHARE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const card = SHARE_CARD;
  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, SHARE_SIZE, SHARE_SIZE);
  ctx.fillStyle = colors.sheet;
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, 48);
  ctx.fill();
  // Right away – a newer cutter may take this one's place meanwhile.
  ctx.drawImage(cutter, card.x, card.y, card.w, card.h);

  await document.fonts.load(`700 1em ${FONT}`).catch(() => undefined);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.text;
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(truncate(ctx, name, card.w), card.x, card.y + card.h + 120);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 38px ${FONT}`;
  ctx.fillText(SITE_LINE, card.x, SHARE_SIZE - 70, card.w);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  // Freed right away: iOS Safari's canvas memory is tight and freed late.
  canvas.width = canvas.height = 0;
  return blob;
};

/** The message around the card – the same layout as the card page's ring. */
const drawRing = (
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  cx: number,
  cy: number,
  stage: number
) => {
  const { content, size, spacing } = ringLayout(text);
  const unit = stage / 100;
  const radius = RING_RADIUS * unit;
  ctx.font = `600 ${size * unit}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  let along = 0;
  for (const char of content) {
    const width = ctx.measureText(char).width;
    // Clockwise from the top, the letters standing outwards.
    const angle = -Math.PI / 2 + (along + width / 2) / radius;
    ctx.save();
    ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(char, -width / 2, 0);
    ctx.restore();
    along += width + spacing * unit;
  }
};

/** The paper card, tilted a little: the cutter on it, name and size below. */
const drawCard = (
  ctx: CanvasRenderingContext2D,
  { colors, cutter, name, size }: CardPicture,
  cx: number,
  cy: number,
  stage: number
) => {
  const side = stage * 0.59;
  const half = side / 2;
  const pad = stage * 0.045;
  const label = stage * 0.046;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = "rgb(4 8 60 / 0.5)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  ctx.fillStyle = colors.sheet;
  ctx.beginPath();
  ctx.roundRect(-half, -half, side, side, stage * 0.055);
  ctx.fill();
  ctx.shadowColor = "transparent";

  if (cutter) {
    const boxWidth = side - 2 * pad;
    const boxHeight = side - 2 * pad - label * 1.5;
    const scale = Math.min(boxWidth / cutter.width, boxHeight / cutter.height);
    const width = cutter.width * scale;
    const height = cutter.height * scale;
    ctx.drawImage(
      cutter,
      -width / 2,
      -half + pad + (boxHeight - height) / 2,
      width,
      height
    );
  }

  const baseline = half - pad;
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${label * 0.68}px ${FONT}`;
  const sizeWidth = ctx.measureText(size).width;
  ctx.fillStyle = colors.inkMuted;
  ctx.fillText(size, half - pad - sizeWidth, baseline);
  ctx.font = `700 ${label}px ${FONT}`;
  ctx.fillStyle = colors.ink;
  ctx.fillText(
    truncate(ctx, name, side - 2 * pad - sizeWidth - label),
    -half + pad,
    baseline
  );
  ctx.restore();
};

/**
 * Paints the greeting card as a picture to share – Instagram and the like
 * take pictures, not links: who it is for, the card with the cutter and the
 * message around it, who it is from, and where it was made.
 */
export const paintCardPicture = async (card: CardPicture) => {
  await Promise.all([
    document.fonts.load(`700 1em ${FONT}`),
    document.fonts.load(`600 1em ${FONT}`),
  ]).catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { colors } = card;
  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  glow(ctx, WIDTH / 2, 660, 560, "rgb(255 255 255 / 0.2)");
  glow(ctx, WIDTH / 2, HEIGHT + 200, 820, "rgb(255 71 208 / 0.32)");

  // Who it is for: big, chunky, a little tilted.
  ctx.save();
  ctx.translate(WIDTH / 2, 170);
  ctx.rotate((-2 * Math.PI) / 180);
  const headingSize = fitFont(ctx, card.heading, 700, 100, WIDTH - 140);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = headingSize * 0.05;
  ctx.strokeStyle = colors.onPage;
  ctx.fillStyle = colors.onPage;
  ctx.strokeText(card.heading, 0, 0);
  ctx.fillText(card.heading, 0, 0);
  ctx.restore();

  const stage = 860;
  const cy = 680;
  drawRing(ctx, card.ring, colors.onPage, WIDTH / 2, cy, stage);
  drawCard(ctx, card, WIDTH / 2, cy, stage);

  ctx.textAlign = "center";
  if (card.from) {
    ctx.save();
    ctx.translate(WIDTH / 2, 1195);
    ctx.rotate((-1 * Math.PI) / 180);
    fitFont(ctx, card.from, 600, 56, WIDTH - 200);
    ctx.fillStyle = colors.onPageMuted;
    ctx.fillText(card.from, 0, 0);
    ctx.restore();
  }
  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = colors.onPageMuted;
  ctx.fillText(card.site, WIDTH / 2, HEIGHT - 52);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  // Freed right away: iOS Safari's canvas memory is tight and freed late.
  canvas.width = canvas.height = 0;
  return blob;
};
