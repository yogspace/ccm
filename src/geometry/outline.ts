import { contours } from "d3-contour";

export type Point = [number, number];
export type Ring = Point[];

/** Fehler im Eingabebild; `code` ist ein Übersetzungsschlüssel unter `errors`. */
export class InputError extends Error {
  code: "invalidSvg" | "noCanvas" | "empty";

  constructor(code: InputError["code"]) {
    super(code);
    this.code = code;
  }
}

/** Auflösung, auf der die Kontur gesucht wird (die Zeichenfläche ist größer). */
const TRACE_RES = 512;
const PAD = 2;
/**
 * So dick (Pixel bei der Importgröße) werden Linien im zweiten Versuch
 * gezeichnet, wenn ein SVG nur aus Haarlinien besteht – dünner fände die
 * Kontursuche nichts.
 */
const MIN_LINE = 10;

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new InputError("noCanvas");
  return ctx;
};

/**
 * Gibt SVGs eine feste Pixelgröße, damit sie scharf und im richtigen
 * Seitenverhältnis gerendert werden. Mit `thicken` werden alle Linien
 * mindestens `MIN_LINE` Pixel dick.
 */
export const prepareSvg = (text: string, size: number, thicken = false) => {
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

  if (thicken) {
    // Strichstärke in Einheiten der viewBox: so viele Einheiten sind MIN_LINE Pixel.
    const extent =
      viewBox?.length === 4
        ? Math.max(viewBox[2], viewBox[3])
        : Math.max(width, height) || size;
    const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `*{stroke-width:${(MIN_LINE * extent) / size}px!important}`;
    svg.prepend(style);
  }

  svg.setAttribute("width", String(aspect >= 1 ? size : size * aspect));
  svg.setAttribute("height", String(aspect >= 1 ? size / aspect : size));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return new XMLSerializer().serializeToString(doc);
};

/**
 * Rendert ein Bild und macht daraus schwarze Tinte auf transparentem Grund:
 * dunkel = Form, hell = Hintergrund (weiße Hintergründe, häufig bei PNGs,
 * dürfen nicht zur Form werden). Ist aber fast alles Gemalte hell – etwa
 * weiße Linien auf transparentem Grund –, zählt einfach alles Gemalte; außer
 * es bedeckt fast das ganze Bild, dann ist es eben doch nur Hintergrund.
 */
const renderInk = async (blob: Blob) => {
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
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    const ink = new Uint8ClampedArray(data.length / 4);
    let painted = 0;
    let inked = 0;
    for (let i = 0; i < ink.length; i++) {
      const o = i * 4;
      const luminance =
        (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
      ink[i] = data[o + 3] * Math.min(1, (1 - luminance) * 4);
      if (data[o + 3] > 127) painted++;
      if (ink[i] > 127) inked++;
    }
    const allPaint =
      painted > 0 && inked < painted * 0.02 && painted < ink.length * 0.9;
    for (let i = 0; i < ink.length; i++) {
      const o = i * 4;
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      if (!allPaint) data[o + 3] = ink[i];
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Lädt ein SVG (oder PNG) als schwarze Silhouette auf transparentem Grund,
 * passend für die Zeichenfläche. Besteht ein SVG nur aus Haarlinien, werden
 * sie für einen zweiten Versuch dicker gezeichnet. Bleibt nichts übrig, gibt
 * es einen Fehler statt einer leeren Fläche.
 */
export const loadSilhouette = async (file: File, size: number) => {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (!isSvg) {
    const canvas = await renderInk(file);
    if (traceOutline(canvas).length === 0) throw new InputError("empty");
    return canvas;
  }
  const text = await file.text();
  const render = (thicken: boolean) =>
    renderInk(
      new Blob([prepareSvg(text, size, thicken)], { type: "image/svg+xml" })
    );
  let canvas = await render(false);
  if (traceOutline(canvas).length === 0) canvas = await render(true);
  if (traceOutline(canvas).length === 0) throw new InputError("empty");
  return canvas;
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
