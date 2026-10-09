/**
 * The app's state in one store (valtio): components read exactly what they
 * need via `useSnapshot(store)` and only re-render when that changes. Changes
 * go through the actions below (or straight to the proxy). Side effects –
 * cutter in the worker, link in the hash, cookie jar, scroll lock – are hooked up
 * once at start by `connectStore`.
 *
 * Large immutable data (drawing, contours, model) sits in the store via `ref`:
 * it is only ever replaced as a whole, never tracked or copied.
 */

import { flushSync } from "react-dom";
import { proxy, ref, snapshot, subscribe, useSnapshot } from "valtio";
import {
  bakeCookie,
  jarClosed,
  loadJar,
  rememberJarClosed,
  type SavedCookie,
  storeJar,
  trimJar,
} from "./cookie-jar";
import {
  type CutterParams,
  defaultParams,
  SIZE_RANGE,
} from "./geometry/cutter";
import type { CutterRequest, CutterResponse } from "./geometry/cutter-worker";
import type { MeshData } from "./geometry/mesh";
import { InputError, type Ring, traceOutline } from "./geometry/outline";
import { type Greeting, greetingUrl } from "./greeting";
import type { de } from "./i18n/de";
import { shortShapeMissing } from "./short-shape";
import { initialUnit, storeUnit, type Unit } from "./units";
import { type Drawing, isEmptyDrawing, readHash, writeHash } from "./url-state";

type ErrorKey = keyof (typeof de)["errors"];

/** Stored via `ref`: valtio does not track it, snapshots hand it out unchanged. */
type Ref<T extends object> = ReturnType<typeof ref<T>>;

/** Tool: draw, erase or move shapes. */
export type Tool = "pen" | "eraser" | "move";

type Cutter = {
  /** The geometry engine in the worker has loaded. */
  ready: boolean;
  mesh: Ref<MeshData> | null;
  /** Final contour, normalised to 0…1 – as an overlay on the drawing. */
  outline: Ref<Ring[]>;
  /** Icing of the baked cookie, normalised like the contour. */
  icing: Ref<Ring[]>;
  error?: "engine" | "build";
};

type State = {
  /** Name of the creation – for file names, sharing and the link. */
  name: string;
  params: CutterParams;
  /** What was drawn, as vectors – this is what gets shared. */
  drawing: Ref<Drawing>;
  /** The traced contour of the drawing – the cutter is made from it. */
  rings: Ref<Ring[]>;
  /** Error while reading the drawing or a file. */
  inputError?: ErrorKey;
  cutter: Cutter;
  unit: Unit;
  tool: Tool;
  /** Brush size in pixels of the drawing area. */
  brush: number;
  /** Turntable of the 3D view. */
  autoRotate: boolean;
  /** Drawing area enlarged. */
  expanded: boolean;
  /** Open dialogs (imprint, sharing) – while > 0 the page does not scroll. */
  dialogs: number;
  /**
   * Scale: how many mm the drawing area is wide. It stays put while drawing –
   * then `params.size` follows what was drawn; moving the size slider changes
   * it instead (the grid zooms).
   */
  sheet: number;
  /** Creations kept as cookies (cookie-jar.ts), newest first. */
  jar: Ref<SavedCookie[]>;
  /** The cookie bar is open – on every visit, until closed. */
  jarOpen: boolean;
  /** The cookie saved last (its hash) – it pops into the bar. */
  lastSaved: string | null;
};

/** Longest side of a set of contours (normalised 0…1), 0 if there are none. */
const extentOf = (rings: Ring[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return Math.max(0, maxX - minX, maxY - minY);
};

/** Without a shape: assume a drawing will fill about 70 % of the area. */
const EMPTY_SHARE = 0.7;

/** The scale at which `size` is the longest side of these contours. */
const sheetFor = (size: number, rings: Ring[]) =>
  size / (extentOf(rings) || EMPTY_SHARE);

/** State from a shared link – read once on load. */
const shared = readHash(window.location.hash);
const savedCookies = loadJar();

/**
 * What the drawing area starts with. Old links bring only the contour, new
 * ones the drawing – then the contour comes from tracing it (`trace`).
 */
export const initial = {
  drawing: shared.drawing,
  trace: shared.rings.length === 0,
};

export const store = proxy<State>({
  name: shared.name,
  params: { ...shared.params },
  drawing: ref(shared.drawing),
  rings: ref(shared.rings),
  cutter: { ready: false, mesh: null, outline: ref([]), icing: ref([]) },
  unit: initialUnit(),
  tool: "pen",
  brush: 24,
  autoRotate: true,
  expanded: false,
  dialogs: 0,
  sheet: sheetFor(shared.params.size, shared.rings),
  jar: ref(savedCookies),
  jarOpen: savedCookies.length > 0 && !jarClosed(),
  lastSaved: null,
  // A short link whose model is gone (short-shape.ts): said right away.
  inputError: shortShapeMissing() ? "gone" : undefined,
});

/**
 * A shared drawing (not just a contour) is traced only once the drawing area
 * paints it: that first trace sets the scale from the link's size instead of
 * changing the size.
 */
let calibrating = initial.trace && !isEmptyDrawing(shared.drawing);

// ---------- Actions ----------

export const setName = (name: string) => {
  store.name = name;
};

export const setParam = <K extends keyof CutterParams>(
  key: K,
  value: CutterParams[K]
) => {
  store.params[key] = value;
  // A new size scales what was drawn: the grid zooms.
  if (key === "size") store.sheet = sheetFor(value, store.rings);
};

export const resetParams = () => {
  store.params = { ...defaultParams };
  store.sheet = sheetFor(defaultParams.size, store.rings);
};

export const setUnit = (unit: Unit) => {
  store.unit = unit;
  storeUnit(unit);
};

/**
 * After every stroke, import, undo or clear: keep the drawing, trace the
 * contour. The grid keeps its scale – what measures 50 mm on it becomes a
 * 50 mm cutter, so the size follows the drawing (within the slider's range).
 */
export const drawingChanged = (canvas: HTMLCanvasElement, drawing: Drawing) => {
  store.drawing = ref(drawing);
  try {
    const rings = traceOutline(canvas);
    store.rings = ref(rings);
    store.inputError = undefined;
    const extent = extentOf(rings);
    if (extent === 0) return;
    if (calibrating) {
      calibrating = false;
      store.sheet = store.params.size / extent;
      return;
    }
    // Small is fine (even a first dot); only beyond the maximum does the grid
    // have to give way.
    const size = Math.max(0.1, Math.round(extent * store.sheet * 10) / 10);
    const clamped = Math.min(SIZE_RANGE.max, size);
    store.params.size = clamped;
    if (clamped !== size) store.sheet = clamped / extent;
  } catch (cause) {
    store.inputError = cause instanceof InputError ? cause.code : "read";
  }
};

export const importFailed = (cause: unknown) => {
  console.error(cause);
  store.inputError = cause instanceof InputError ? cause.code : "read";
};

export const toggleAutoRotate = () => {
  store.autoRotate = !store.autoRotate;
};

/** Turning the 3D view yourself stops the turntable. */
export const stopAutoRotate = () => {
  store.autoRotate = false;
};

/**
 * Animate the layout switch with a view transition where the browser can. For
 * that React must render synchronously – so whoever reads `expanded`
 * subscribes with `useSnapshot(store, { sync: true })`.
 */
export const toggleExpanded = () => {
  const toggle = () =>
    flushSync(() => {
      store.expanded = !store.expanded;
    });
  if (document.startViewTransition) document.startViewTransition(toggle);
  else toggle();
};

/** A dialog opens or closes – while one is open, the page does not scroll. */
export const dialogOpened = () => {
  store.dialogs += 1;
};

export const dialogClosed = () => {
  store.dialogs = Math.max(0, store.dialogs - 1);
};

/** Link with the current drawing. */
const currentHash = () =>
  writeHash({
    name: store.name,
    params: { ...store.params },
    drawing: store.drawing,
  });

/** At the top the page is shared: without a language path, recipients land in their own language. */
export const pageUrl = () => `${window.location.origin}/`;

/** Below, the creation: a link with the drawing, also without a language path. */
export const creationUrl = () => `${window.location.origin}/${currentHash()}`;

/** The creation as a greeting card (its own page), in this language. */
export const greetingLink = (greeting: Greeting, lang: string) =>
  greetingUrl(currentHash(), greeting, lang);

/**
 * Keeps the creation on screen as a cookie in the bar (the newest first; the
 * same creation only once) and opens the bar.
 */
/** Keeps the creation as a cookie in the bar; its hash, or null if none yet. */
export const saveCookie = () => {
  const { mesh, outline, icing } = store.cutter;
  if (!mesh || outline.length === 0) return null;
  const hash = currentHash();
  // Saved again, an online cookie stays online.
  const { code } = store.jar.find((other) => other.hash === hash) ?? {};
  const cookie = {
    ...bakeCookie({
      hash,
      name: store.name,
      size: store.params.size,
      outline,
      icing,
    }),
    ...(code && { code }),
  };
  store.jar = ref(
    trimJar([cookie, ...store.jar.filter((other) => other.hash !== hash)])
  );
  store.lastSaved = hash;
  setJarOpen(true);
  return hash;
};

/** Eats a cookie: it leaves the bar for good. */
export const eatCookie = (hash: string) => {
  store.jar = ref(store.jar.filter((cookie) => cookie.hash !== hash));
  if (store.jar.length === 0) store.jarOpen = false;
};

export const setJarOpen = (open: boolean) => {
  store.jarOpen = open;
  rememberJarClosed(!open);
};

/** Opens a saved creation: its link, loaded afresh (Back returns). */
export const openCookie = (hash: string) => {
  const { pathname, search } = window.location;
  window.history.pushState(null, "", `${pathname}${search}${hash}`);
  window.location.reload();
};

// ---------- Derived ----------

/** The error to show: the input first, then the cutter. */
export const useError = () => {
  const { inputError, cutter } = useSnapshot(store);
  return inputError ?? cutter.error;
};

/** Scale for the coordinate system: this many mm is the drawing area wide. */
export const useMmPerCanvas = () => useSnapshot(store).sheet;

// ---------- Side effects ----------

/**
 * Connects the store to the outside world; returns the cleanup (for useEffect).
 * - The cutter is built in a web worker, so drawing and sliders stay smooth.
 *   Answers to outdated jobs are dropped.
 * - The link in the address bar follows the state, so it can be shared any
 *   time – once nothing has happened for a while.
 * - Open dialogs lock scrolling.
 */
export const connectStore = () => {
  const worker = new Worker(
    new URL("./geometry/cutter-worker.ts", import.meta.url),
    { type: "module" }
  );
  let latest = 0;
  worker.onmessage = ({ data }: MessageEvent<CutterResponse>) => {
    if (data.type === "ready") store.cutter.ready = true;
    else if (data.type === "engine-error") store.cutter.error = "engine";
    else if (data.id !== latest) return;
    else if (data.type === "result") {
      store.cutter = {
        ready: true,
        mesh: data.mesh && ref(data.mesh),
        outline: ref(data.outline),
        icing: ref(data.icing),
      };
    } else store.cutter.error = "build";
  };
  const build = () => {
    // A copy of the dimensions: postMessage cannot clone the proxy itself.
    const request: CutterRequest = {
      id: ++latest,
      rings: store.rings,
      params: { ...store.params },
    };
    worker.postMessage(request);
  };

  let linkTimer = 0;
  const writeLink = () => {
    clearTimeout(linkTimer);
    linkTimer = window.setTimeout(() => {
      const { pathname, search } = window.location;
      window.history.replaceState(
        null,
        "",
        `${pathname}${search}${currentHash()}`
      );
    }, 300);
  };

  const lockScroll = () =>
    document.documentElement.toggleAttribute("data-locked", store.dialogs > 0);

  // Changes arrive batched. What changed shows from comparing snapshots:
  // unchanged parts keep their identity.
  let last = snapshot(store);
  const unsubscribe = subscribe(store, () => {
    const next = snapshot(store);
    const changed = (key: keyof State) => next[key] !== last[key];
    if (changed("rings") || changed("params")) build();
    if (changed("name") || changed("params") || changed("drawing")) writeLink();
    if (changed("dialogs")) lockScroll();
    if (changed("jar")) storeJar(store.jar);
    last = next;
  });

  build();
  writeLink();
  lockScroll();

  return () => {
    unsubscribe();
    clearTimeout(linkTimer);
    worker.terminate();
  };
};
