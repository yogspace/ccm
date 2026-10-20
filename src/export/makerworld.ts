import { strToU8, type Zippable, zipSync } from "fflate";
import {
  CARD_PICTURE_COLORS,
  type CardPicture,
  drawCard,
  drawHeading,
  drawRing,
  FONT,
  fitFont,
  glazeShades,
  glow,
  SITE_LINE,
} from "../components/card-image";
import { disposeCookie } from "../cookies/dough";
import { cookieSnapshot } from "../cookies/renderer";
import { type CookieShape, createShapeCookie } from "../cookies/shape-cookie";
import type { MeshData } from "../geometry/mesh";
import type { Greeting } from "../greeting";
import { renderMeshTop } from "../render-top";
import { toThreeMf } from "./three-mf";

/**
 * Everything to put a cutter on MakerWorld, in one zip – for the admin only
 * (export-buttons.tsx), always in English: the 3MF, pictures of the model
 * alone and as on its greeting card's page, each upright (3:4) and across
 * (4:3), and the text for the upload with the links to the editor and to a
 * greeting card. All in the color the cutter has on screen.
 */

/** The test card: the pictures show it, the upload text links to it. */
export const MAKERWORLD_GREETING: Greeting = {
  to: "",
  from: "MXWR",
  message: "Hello MakerWorld!",
  color: 0,
};

const FORMATS = [
  { label: "3x4", width: 1200, height: 1600 },
  { label: "4x3", width: 1600, height: 1200 },
] as const;
const MARGIN = 70;
/** The cookie's picture, square – drawn smaller where it goes. */
const COOKIE_PIXELS = 720;

type Kit = {
  mesh: MeshData;
  /** The cutter's name, as on its card. */
  name: string;
  /** Base of the file names (`heart-80mm`). */
  fileName: string;
  /** The cutter's color on screen: the pictures, the 3MF's filament. */
  color: string;
  /** The cookie it bakes, or `null` – iced in `color`. */
  cookie: CookieShape | null;
  /** Its size on the card (“80 mm”). */
  sizeLabel: string;
  editorUrl: string;
  cardUrl: string;
};

/** The one of `colors` (hex) closest to `target` – for the card's link. */
export const nearestColor = (colors: string[], target: string) => {
  const rgb = (hex: string) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const [r, g, b] = rgb(target);
  let best = 0;
  let bestDistance = Infinity;
  colors.forEach((color, index) => {
    const [r2, g2, b2] = rgb(color);
    const distance = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
};

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
};

/** The cookie, baked once and photographed a little from the front. */
const bake = (shape: CookieShape | null) => {
  if (!shape) return null;
  try {
    const object = createShapeCookie(shape);
    try {
      return cookieSnapshot(object, COOKIE_PIXELS, -0.45);
    } finally {
      disposeCookie(object);
    }
  } catch {
    return null;
  }
};

/** Where a transparent picture is not empty: its left, right and bottom. */
const extentOf = (picture: HTMLCanvasElement) => {
  const { width, height } = picture;
  const pixels = picture.getContext("2d")?.getImageData(0, 0, width, height);
  if (!pixels) return null;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels.data[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = y;
    }
  }
  return right < 0 ? null : { left, right, bottom };
};

/**
 * The model alone, like a product shot: a backdrop tinted in its color,
 * deeper toward the floor, a soft shadow right under it.
 */
const paintModel = (
  mesh: MeshData,
  color: string,
  width: number,
  height: number
) => {
  const target = canvasOf(width, height);
  if (!target) return null;
  const { canvas, ctx } = target;
  const shades = glazeShades(color, CARD_PICTURE_COLORS);
  ctx.fillStyle = shades.sheet;
  ctx.fillRect(0, 0, width, height);
  const floor = ctx.createLinearGradient(0, 0, 0, height);
  floor.addColorStop(0, shades.sheet);
  floor.addColorStop(1, shades.page);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  const box = { w: width - 2 * MARGIN, h: height - 2 * MARGIN };
  const view = renderMeshTop(mesh, color, box.w, box.h);
  if (!view) return canvas;
  const extent = extentOf(view);
  if (extent) {
    const span = extent.right - extent.left;
    ctx.save();
    ctx.filter = "blur(36px)";
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shades.ink;
    ctx.beginPath();
    ctx.ellipse(
      MARGIN + (extent.left + extent.right) / 2,
      MARGIN + extent.bottom,
      span * 0.42,
      span * 0.06,
      0,
      0,
      2 * Math.PI
    );
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(view, MARGIN, MARGIN, box.w, box.h);
  view.width = view.height = 0;
  return canvas;
};

/** Where things go: upright the cookie below the card, across beside it. */
const layoutOf = (width: number, height: number) =>
  width > height
    ? {
        heading: { x: width / 2, y: 150, size: 110 },
        stage: { x: 560, y: 680, size: 860 },
        cookie: { x: 1170, y: 650, size: 640, turn: 8 },
        from: { x: 1170, y: 1030 },
        site: { x: 1170, y: 1100 },
      }
    : {
        heading: { x: width / 2, y: 190, size: 120 },
        stage: { x: width / 2, y: 770, size: 960 },
        cookie: { x: 850, y: 1090, size: 600, turn: 10 },
        from: { x: width / 2, y: 1455 },
        site: { x: width / 2, y: height - 56 },
      };

/**
 * The cutter as on its greeting card's page: its name big on top, the card
 * with the cutter in the ring of the test card's message, the cookie it
 * bakes beside it, who the card is from and the site.
 */
const paintCardView = async (
  { mesh, name, color, sizeLabel }: Kit,
  cookie: HTMLCanvasElement | null,
  width: number,
  height: number
) => {
  const target = canvasOf(width, height);
  if (!target) return null;
  const { canvas, ctx } = target;
  const colors = glazeShades(color, CARD_PICTURE_COLORS);
  await Promise.all([
    document.fonts.load(`700 1em ${FONT}`),
    document.fonts.load(`600 1em ${FONT}`),
  ]).catch(() => undefined);
  const layout = layoutOf(width, height);
  const { stage } = layout;

  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, width, height);
  glow(ctx, stage.x, stage.y, stage.size * 0.75, "rgb(255 255 255 / 0.2)");
  glow(ctx, width / 2, height + 240, width * 0.7, "rgb(255 71 208 / 0.32)");
  drawHeading(
    ctx,
    name,
    colors.onPage,
    layout.heading.x,
    layout.heading.y,
    layout.heading.size,
    width - 200
  );

  const cutter = renderMeshTop(mesh, color, 900, 788);
  const card: CardPicture = {
    colors,
    cutter,
    heading: name,
    from: "",
    ring: MAKERWORLD_GREETING.message,
    name,
    size: sizeLabel,
    site: "",
  };
  drawRing(ctx, card.ring, colors.onPage, stage.x, stage.y, stage.size);
  drawCard(ctx, card, stage.x, stage.y, stage.size);
  if (cutter) cutter.width = cutter.height = 0;

  if (cookie) {
    const { x, y, size, turn } = layout.cookie;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.shadowColor = "rgb(4 8 60 / 0.45)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    ctx.drawImage(cookie, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.save();
  ctx.translate(layout.from.x, layout.from.y);
  ctx.rotate((-1 * Math.PI) / 180);
  const from = `from ${MAKERWORLD_GREETING.from}`;
  fitFont(ctx, from, 600, 60, 600);
  ctx.fillStyle = colors.onPageMuted;
  ctx.fillText(from, 0, 0);
  ctx.restore();
  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = colors.onPageMuted;
  ctx.fillText(SITE_LINE, layout.site.x, layout.site.y);
  return canvas;
};

const png = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array | null>((resolve) =>
    canvas.toBlob(async (blob) => {
      resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null);
    }, "image/png")
  );

/** Title, description, tags and the links, ready to paste into the upload. */
const uploadText = ({
  name,
  dimensions: [width, depth, height],
  editorUrl,
  cardUrl,
}: Pick<Kit, "name" | "editorUrl" | "cardUrl"> & {
  dimensions: MeshData["dimensions"];
}) => {
  const mm = (value: number) => Math.round(value);
  const title = /cutter/i.test(name) ? name : `${name} Cookie Cutter`;
  return `TITLE
${title}

DESCRIPTION
${name} – a cookie cutter, ${mm(width)} × ${mm(depth)} mm and ${mm(height)} mm tall, made with Cookie Cutter Maker.

Make it yours: open it in the editor, change the drawing or the size and download your own version – free, right in your browser, no account needed.
${editorUrl}

Or send it as a greeting card: a page of its own with the cutter in 3D, your message around it and the files to print.
${cardUrl}

Draw your own cookie cutter from any doodle or picture: https://ccm.mxwr.de

PRINTING
- Ready for the Bambu Lab A1: 0.4 mm nozzle, Bambu PLA Basic, 0.2 mm layers, Textured PEI Plate. Another printer? Just pick it in Bambu Studio.
- The rim sits on the print bed, no supports needed.
- For dough, food-safe filament is best. Wash by hand in lukewarm water, not in the dishwasher: PLA warps from about 55 °C.

TAGS
cookie cutter, cookies, baking, christmas, halloween, kitchen, gift, custom

LINKS
Editor: ${editorUrl}
Card: ${cardUrl}
`;
};

/** The zip with the 3MF, four pictures and the upload text. */
export const makerWorldZip = async (kit: Kit) => {
  const {
    mesh,
    name,
    fileName,
    color,
    cookie: shape,
    editorUrl,
    cardUrl,
  } = kit;
  const threeMf = await toThreeMf(mesh, name, color);
  // The 3MF and the pictures are compressed already: stored as they are.
  const files: Zippable = {
    [`${fileName}.3mf`]: [
      new Uint8Array(await threeMf.arrayBuffer()),
      { level: 0 },
    ],
  };
  const cookie = bake(shape ? { ...shape, glaze: color } : null);
  for (const { label, width, height } of FORMATS) {
    const pictures = [
      ["model", paintModel(mesh, color, width, height)],
      ["card", await paintCardView(kit, cookie, width, height)],
    ] as const;
    for (const [kind, canvas] of pictures) {
      if (!canvas) continue;
      const bytes = await png(canvas);
      // Freed right away: large canvases add up.
      canvas.width = canvas.height = 0;
      if (bytes)
        files[`${fileName}-${kind}-${label}.png`] = [bytes, { level: 0 }];
    }
  }
  if (cookie) cookie.width = cookie.height = 0;
  files[`${fileName}-makerworld.txt`] = strToU8(
    uploadText({ name, dimensions: mesh.dimensions, editorUrl, cardUrl })
  );
  return new Blob([zipSync(files)], { type: "application/zip" });
};
