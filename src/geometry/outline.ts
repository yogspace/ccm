import { contours } from "d3-contour";

export type Point = [number, number];
export type Ring = Point[];

/** Fehler im Eingabebild; `code` ist ein Übersetzungsschlüssel unter `errors`. */
export class InputError extends Error {
  code: "invalidSvg" | "noCanvas";

  constructor(code: InputError["code"]) {
    super(code);
    this.code = code;
  }
}

/** Auflösung, auf der die Kontur gesucht wird (die Zeichenfläche ist größer). */
const TRACE_RES = 512;
const PAD = 2;

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new InputError("noCanvas");
  return ctx;
};

/** Gibt SVGs eine feste Pixelgröße, damit sie scharf und im richtigen Seitenverhältnis gerendert werden. */
export const prepareSvg = (text: string, size: number) => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg") throw new InputError("invalidSvg");

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

  svg.setAttribute("width", String(aspect >= 1 ? size : size * aspect));
  svg.setAttribute("height", String(aspect >= 1 ? size / aspect : size));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return new XMLSerializer().serializeToString(doc);
};

/**
 * Lädt ein SVG (oder PNG) als schwarze Silhouette auf transparentem Grund,
 * passend für die Zeichenfläche.
 */
export const loadSilhouette = async (file: File, size: number) => {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const blob = isSvg
    ? new Blob([prepareSvg(await file.text(), size)], {
        type: "image/svg+xml",
      })
    : file;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = context2d(canvas);
    ctx.drawImage(img, 0, 0);
    // Weiße Hintergründe (häufig bei PNGs) dürfen nicht zur Form werden.
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      const luminance =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const ink = Math.min(1, (1 - luminance) * 4);
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(data[i + 3] * ink);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Sucht auf dem Alpha-Kanal der Zeichnung alle Konturen (äußere Ringe und
 * Löcher). Koordinaten normiert auf 0…1, y zeigt nach unten wie im Canvas.
 */
export const traceOutline = (source: HTMLCanvasElement): Ring[] => {
  const canvas = document.createElement("canvas");
  canvas.width = TRACE_RES + 2 * PAD;
  canvas.height = TRACE_RES + 2 * PAD;
  const ctx = context2d(canvas);
  // Leichtes Weichzeichnen glättet zittrige Striche.
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(source, PAD, PAD, TRACE_RES, TRACE_RES);

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const values: number[] = new Array(width * height);
  let any = false;
  for (let i = 0; i < values.length; i++) {
    values[i] = data[i * 4 + 3] / 255;
    any ||= values[i] >= 0.5;
  }
  if (!any) return [];

  const [level] = contours().size([width, height]).thresholds([0.5])(values);
  return level.coordinates.flatMap((polygon) =>
    polygon.map((ring) =>
      ring.map(
        ([x, y]): Point => [(x - PAD) / TRACE_RES, (y - PAD) / TRACE_RES]
      )
    )
  );
};
