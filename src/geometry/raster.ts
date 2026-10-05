import { contours } from "d3-contour";

export type Point = [number, number];
export type Ring = Point[];

/** Kantenlänge der Motivfläche in Pixeln, auf der die Kontur gesucht wird. */
export const RES = 512;
const PAD = 8;

/** Gibt SVGs eine feste Pixelgröße, damit sie scharf und im richtigen Seitenverhältnis gerendert werden. */
const prepareSvg = (text: string) => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg") throw new Error("Keine gültige SVG-Datei.");

  const viewBox = svg
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");

  let aspect = 1;
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    aspect = viewBox[2] / viewBox[3];
  } else if (width > 0 && height > 0) {
    aspect = width / height;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  svg.setAttribute("width", String(aspect >= 1 ? RES : RES * aspect));
  svg.setAttribute("height", String(aspect >= 1 ? RES / aspect : RES));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return new XMLSerializer().serializeToString(doc);
};

/** Zeichnet eine Bildquelle eingepasst und mit Rand auf eine weiße Fläche. */
export const rasterize = (
  source: CanvasImageSource,
  width: number,
  height: number,
  /** Weichzeichnen in Pixeln, glättet zittrige Kanten. */
  blur = 0
) => {
  const canvas = document.createElement("canvas");
  canvas.width = RES + 2 * PAD;
  canvas.height = RES + 2 * PAD;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas wird nicht unterstützt.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = RES / Math.max(width, height);
  const w = width * scale;
  const h = height * scale;
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(source, PAD + (RES - w) / 2, PAD + (RES - h) / 2, w, h);
  return canvas;
};

export const loadImageFile = async (file: File) => {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const blob = isSvg
    ? new Blob([prepareSvg(await file.text())], { type: "image/svg+xml" })
    : file;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return rasterize(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Sucht die Außenkonturen aller dunklen Flächen. Innenkonturen werden
 * verworfen – ein Ausstecher schneidet nur die Silhouette.
 * Koordinaten in Pixeln, y nach oben.
 */
export const traceOutline = (canvas: HTMLCanvasElement): Ring[] => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  const values: number[] = new Array(width * height);
  for (let i = 0; i < values.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    // Auch helle Farben zählen als Motiv, nur nahezu Weiß ist Hintergrund.
    values[i] = Math.min(1, (1 - luminance) * 4);
  }

  const [level] = contours().size([width, height]).thresholds([0.5])(values);
  if (!level) return [];
  return level.coordinates.map(([exterior]) =>
    exterior.map(([x, y]): Point => [x, height - y])
  );
};
