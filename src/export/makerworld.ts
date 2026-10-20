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
 * alone, as on its greeting card's page and of what the site can do, each
 * upright (3:4) and across (4:3), and the text for the upload with the
 * links to the editor and to a greeting card. All in the color the cutter
 * has on screen.
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
/** One word each, true of every cutter. */
const TAGS = [
  "cookiecutter",
  "cookie",
  "cookies",
  "cutter",
  "baking",
  "bake",
  "kitchen",
  "dough",
  "biscuit",
  "fondant",
  "clay",
  "gift",
];
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
  /** The cookie it bakes, or `null` – three of them make a fan. */
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

/** A cookie, baked once and photographed a little from the front. */
const bake = (shape: CookieShape) => {
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

/**
 * Three of its cookies for a fan, left to right: of chocolate dough, iced in
 * the cutter's color (the middle one, in front) and iced as its seed picks.
 */
const bakeFan = (shape: CookieShape | null, color: string) =>
  shape
    ? [
        { ...shape, seed: shape.seed + 1, chocolate: true },
        { ...shape, glaze: color },
        { ...shape, seed: shape.seed + 2 },
      ].map(bake)
    : [];

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

/**
 * Where things go – one after another: the name, the cookie, who it is
 * from. Upright the ring between name and cookie, across the ring on the
 * left and the three in a column beside it.
 */
const layoutOf = (width: number, height: number) =>
  width > height
    ? {
        heading: { x: 1280, y: 400, size: 130, width: 520 },
        stage: { x: 520, y: 620, size: 860 },
        cookie: { x: 1280, y: 620, size: 240 },
        from: { x: 1280, y: 850, width: 520 },
      }
    : {
        heading: { x: width / 2, y: 285, size: 120, width: width - 200 },
        stage: { x: width / 2, y: 790, size: 860 },
        cookie: { x: width / 2, y: 1335, size: 200 },
        from: { x: width / 2, y: 1490, width: 900 },
      };

/**
 * The cutter as on its greeting card's page, the cutter up front: its name
 * big, the card in the ring of the test card's message and the cutter
 * itself, larger than the card, standing out of it; a fan of the cookies it
 * bakes and who the card is from. The site in the corners: its name top
 * left, its address bottom right.
 */
const paintCardView = async (
  { mesh, name, color, sizeLabel }: Kit,
  cookies: (HTMLCanvasElement | null)[],
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
    layout.heading.width
  );

  const card: CardPicture = {
    colors,
    cutter: null,
    heading: name,
    from: "",
    ring: MAKERWORLD_GREETING.message,
    name,
    size: sizeLabel,
    site: "",
  };
  drawRing(ctx, card.ring, colors.onPage, stage.x, stage.y, stage.size);
  drawCard(ctx, card, stage.x, stage.y, stage.size);

  const box = { w: stage.size * 0.92, h: stage.size * 0.78 };
  const cutter = renderMeshTop(mesh, color, box.w, box.h);
  if (cutter) {
    ctx.save();
    ctx.shadowColor = "rgb(4 8 60 / 0.45)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 28;
    ctx.drawImage(
      cutter,
      stage.x - box.w / 2,
      stage.y - stage.size * 0.05 - box.h / 2
    );
    ctx.restore();
    cutter.width = cutter.height = 0;
  }

  // Fanned out about a point below them, the middle one last – on top.
  const { x, y, size } = layout.cookie;
  const pivot = size * 1.6;
  for (const index of [0, 2, 1]) {
    const cookie = cookies[index];
    if (!cookie) continue;
    ctx.save();
    ctx.translate(x, y + pivot);
    ctx.rotate(((index - 1) * 22 * Math.PI) / 180);
    ctx.translate(0, -pivot);
    ctx.shadowColor = "rgb(4 8 60 / 0.35)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(cookie, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.onPageMuted;
  ctx.textAlign = "center";
  const from = `from ${MAKERWORLD_GREETING.from}`;
  fitFont(ctx, from, 600, 64, layout.from.width);
  ctx.fillText(from, layout.from.x, layout.from.y);

  drawCorners(ctx, colors.onPageMuted);
  return canvas;
};

/**
 * The site's name top left, large; its address bottom right – unless the
 * picture says it elsewhere.
 */
const drawCorners = (
  ctx: CanvasRenderingContext2D,
  color: string,
  withAddress = true
) => {
  const { width, height } = ctx.canvas;
  const [brand, address] = SITE_LINE.split(" · ");
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.font = `700 56px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(brand, MARGIN, MARGIN + 42);
  if (withAddress) {
    ctx.font = `600 38px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(address, width - MARGIN, height - MARGIN + 10);
  }
  ctx.restore();
};

/** What the site can do, for the picture that says so. */
const SLOGAN = ["Your drawing.", "Your cookie cutter."];
const FEATURES = [
  ["Draw it or drop in a picture", "Mouse, finger or pen – or an SVG or PNG."],
  ["Holes become inner blades", "Linked on their own: one printable piece."],
  ["Emboss the details", "A second ink presses lines into the dough."],
  ["See it in 3D", "The cutter live – and the cookie it bakes."],
  ["Ready to print", "3MF for Bambu Studio or STL, any size."],
  ["Send it as a greeting card", "Your message running around the cutter."],
] as const;
const INVITATION = "Try it free at ccm.mxwr.de";

/** Words in lines no wider than `width`, in the context's font. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const longer = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(longer).width > width) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * What Cookie Cutter Maker can do, in the cutter's colors: the slogan, the
 * features one by one, an invitation to try it – across with the cutter
 * beside them.
 */
const paintFeatures = async (
  { mesh, color }: Kit,
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
    document.fonts.load(`500 1em ${FONT}`),
  ]).catch(() => undefined);
  const across = width > height;
  const layout = across
    ? {
        slogan: { x: 430, y: 250, size: 92, width: 700, step: 104 },
        cutter: { x: 430, y: 650, w: 760, h: 560 },
        invitation: { x: 430, y: 980 },
        list: { x: 860, y: 300, width: 670, title: 40, text: 30, gap: 30 },
      }
    : {
        slogan: {
          x: width / 2,
          y: 260,
          size: 104,
          width: width - 200,
          step: 120,
        },
        cutter: null,
        invitation: { x: width / 2, y: 1420 },
        list: { x: 120, y: 560, width: 960, title: 46, text: 34, gap: 40 },
      };

  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, width, height);
  glow(ctx, width / 2, height / 2, width * 0.6, "rgb(255 255 255 / 0.18)");
  glow(ctx, width / 2, height + 240, width * 0.7, "rgb(255 71 208 / 0.32)");

  // The slogan in one size – the longer line decides.
  const { slogan } = layout;
  const longest = SLOGAN.reduce((a, b) => (a.length >= b.length ? a : b));
  const sloganSize = fitFont(ctx, longest, 700, slogan.size, slogan.width);
  SLOGAN.forEach((line, index) => {
    drawHeading(
      ctx,
      line,
      colors.onPage,
      slogan.x,
      slogan.y + index * slogan.step * (sloganSize / slogan.size),
      sloganSize,
      slogan.width
    );
  });

  if (layout.cutter) {
    const { x, y, w, h } = layout.cutter;
    const view = renderMeshTop(mesh, color, w, h);
    if (view) {
      ctx.save();
      ctx.shadowColor = "rgb(4 8 60 / 0.45)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 28;
      ctx.drawImage(view, x - w / 2, y - h / 2);
      ctx.restore();
      view.width = view.height = 0;
    }
  }

  // The features, each its sparkle, its name and a line or two about it.
  const { list } = layout;
  const indent = list.title * 1.4;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = list.y;
  for (const [title, text] of FEATURES) {
    ctx.fillStyle = colors.onPage;
    ctx.font = `700 ${list.title}px ${FONT}`;
    ctx.fillText("✦", list.x, y);
    ctx.fillText(title, list.x + indent, y, list.width - indent);
    ctx.fillStyle = colors.onPageMuted;
    ctx.font = `500 ${list.text}px ${FONT}`;
    for (const line of wrap(ctx, text, list.width - indent)) {
      y += list.text * 1.3;
      ctx.fillText(line, list.x + indent, y);
    }
    y += list.title + list.gap;
  }

  // The invitation on a pill of the card's paper.
  ctx.font = `700 46px ${FONT}`;
  const pill = { w: ctx.measureText(INVITATION).width + 110, h: 104 };
  const { invitation } = layout;
  ctx.save();
  ctx.translate(invitation.x, invitation.y);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.shadowColor = "rgb(4 8 60 / 0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = colors.sheet;
  ctx.beginPath();
  ctx.roundRect(-pill.w / 2, -pill.h / 2, pill.w, pill.h, pill.h / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = colors.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(INVITATION, 0, 4);
  ctx.restore();

  // The invitation names the address already.
  drawCorners(ctx, colors.onPageMuted, false);
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
${TAGS.join(", ")}

LINKS
Editor: ${editorUrl}
Card: ${cardUrl}
`;
};

/** The zip with the 3MF, six pictures and the upload text. */
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
  const cookies = bakeFan(shape, color);
  for (const { label, width, height } of FORMATS) {
    const pictures = [
      ["model", paintModel(mesh, color, width, height)],
      ["card", await paintCardView(kit, cookies, width, height)],
      ["features", await paintFeatures(kit, width, height)],
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
  for (const cookie of cookies) if (cookie) cookie.width = cookie.height = 0;
  files[`${fileName}-makerworld.txt`] = strToU8(
    uploadText({ name, dimensions: mesh.dimensions, editorUrl, cardUrl })
  );
  return new Blob([zipSync(files)], { type: "application/zip" });
};
