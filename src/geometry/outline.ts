import { contours } from "d3-contour";

export type Point = [number, number];
export type Ring = Point[];

/** Error in the input image; `code` is a translation key under `errors`. */
export class InputError extends Error {
  code: "invalidSvg" | "noCanvas" | "empty";

  constructor(code: InputError["code"]) {
    super(code);
    this.code = code;
  }
}

/** Resolution at which the contour is traced (the drawing area is larger). */
const TRACE_RES = 512;
const PAD = 2;
/**
 * How thick (pixels at import size) lines are drawn on the second attempt when
 * an SVG consists of hairlines only – any thinner and tracing would find
 * nothing.
 */
const MIN_LINE = 10;

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new InputError("noCanvas");
  return ctx;
};

/**
 * Gives SVGs a fixed pixel size, so they render sharp and in the right aspect
 * ratio. With `thicken` all lines become at least `MIN_LINE` pixels thick.
 */
const prepareSvg = (text: string, size: number, thicken = false) => {
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
    // Stroke width in viewBox units: this many units are MIN_LINE pixels.
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
 * Renders an image and turns it into black ink on a transparent background:
 * dark = shape, light = background (white backgrounds, common in PNGs, must not
 * become the shape). If almost everything painted is light, though – white
 * lines on a transparent background, say – everything painted counts; unless
 * it covers almost the whole image, then it is background after all.
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
 * Loads an SVG (or PNG) as a black silhouette on a transparent background, to
 * fit the drawing area. If an SVG consists of hairlines only, they are drawn
 * thicker on a second attempt. If nothing is left, there is an error instead
 * of an empty area.
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
 * Finds all contours (outer rings and holes) on the drawing's alpha channel.
 * Coordinates normalised to 0…1, y points down as in the canvas.
 */
export const traceOutline = (source: HTMLCanvasElement): Ring[] => {
  const canvas = document.createElement("canvas");
  canvas.width = TRACE_RES + 2 * PAD;
  canvas.height = TRACE_RES + 2 * PAD;
  const ctx = context2d(canvas);
  // A slight blur smooths shaky strokes.
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(source, PAD, PAD, TRACE_RES, TRACE_RES);

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  // Free the pixels right away: Safari on iOS has a tight budget for canvas
  // memory and frees it late – once it is used up, canvases stay blank.
  canvas.width = canvas.height = 0;
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
