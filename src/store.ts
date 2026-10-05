/**
 * Zustand der App in einem Store (valtio): Komponenten lesen per
 * `useSnapshot(store)` genau das, was sie brauchen, und rendern nur neu, wenn
 * sich davon etwas ändert. Geändert wird über die Aktionen unten (oder direkt
 * am Proxy). Nebenwirkungen – Ausstecher im Worker, Link im Hash, Zähler,
 * Scroll-Sperre – verbindet `connectStore` einmal beim Start.
 *
 * Große, unveränderliche Daten (Zeichnung, Konturen, Modell) liegen per `ref`
 * im Store: Sie werden nur als Ganzes ersetzt, nie verfolgt oder kopiert.
 */

import { useMemo } from "react";
import { flushSync } from "react-dom";
import { proxy, ref, snapshot, subscribe, useSnapshot } from "valtio";
import { type CutterParams, defaultParams } from "./geometry/cutter";
import type { CutterRequest, CutterResponse } from "./geometry/cutter-worker";
import type { MeshData } from "./geometry/mesh";
import { InputError, type Ring, traceOutline } from "./geometry/outline";
import type { de } from "./i18n/de";
import { countCreation, loadCreations } from "./stats";
import { initialUnit, storeUnit, type Unit } from "./units";
import { type Drawing, readHash, writeHash } from "./url-state";

export type ErrorKey = keyof (typeof de)["errors"];

/** Per `ref` abgelegt: valtio verfolgt es nicht, Snapshots geben es unverändert heraus. */
type Ref<T extends object> = ReturnType<typeof ref<T>>;

/** Werkzeug: malen, radieren oder Formen verschieben. */
export type Tool = "pen" | "eraser" | "move";

type Cutter = {
  /** Die Geometrie-Engine im Worker ist geladen. */
  ready: boolean;
  mesh: Ref<MeshData> | null;
  /** Finale Kontur, normiert auf 0…1 – als Overlay über der Zeichnung. */
  outline: Ref<Ring[]>;
  error?: "engine" | "build";
};

type State = {
  /** Name der Kreation – für Dateinamen, Teilen und den Link. */
  name: string;
  params: CutterParams;
  /** Was gemalt wurde, als Vektoren – das wird geteilt. */
  drawing: Ref<Drawing>;
  /** Die abgetastete Kontur der Zeichnung, daraus entsteht der Ausstecher. */
  rings: Ref<Ring[]>;
  /** Fehler beim Lesen der Zeichnung oder einer Datei. */
  inputError?: ErrorKey;
  cutter: Cutter;
  unit: Unit;
  tool: Tool;
  /** Strichstärke in Pixeln der Zeichenfläche. */
  brush: number;
  /** Drehteller der 3D-Ansicht. */
  autoRotate: boolean;
  /** Zeichenfläche vergrößert. */
  expanded: boolean;
  /** „x Kreationen erstellt“, `null` solange (oder falls) die API nicht antwortet. */
  creations: number | null;
  /** Offene Fenster (Impressum, Teilen) – solange > 0 scrollt die Seite nicht. */
  dialogs: number;
};

/** Zustand aus einem geteilten Link – einmal beim Laden gelesen. */
const shared = readHash(window.location.hash);

/**
 * Womit die Zeichenfläche startet. Alte Links bringen nur die Kontur mit,
 * neue die Zeichnung – dann entsteht die Kontur erst durch Abtasten (`trace`).
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
  cutter: { ready: false, mesh: null, outline: ref([]) },
  unit: initialUnit(),
  tool: "pen",
  brush: 24,
  autoRotate: true,
  expanded: false,
  creations: null,
  dialogs: 0,
});

// ---------- Aktionen ----------

export const setName = (name: string) => {
  store.name = name;
};

export const setParam = <K extends keyof CutterParams>(
  key: K,
  value: CutterParams[K]
) => {
  store.params[key] = value;
};

export const resetParams = () => {
  store.params = { ...defaultParams };
};

export const setUnit = (unit: Unit) => {
  store.unit = unit;
  storeUnit(unit);
};

/** Nach jedem Strich, Import, Rückgängig oder Löschen: Zeichnung merken, Kontur abtasten. */
export const drawingChanged = (canvas: HTMLCanvasElement, drawing: Drawing) => {
  store.drawing = ref(drawing);
  try {
    store.rings = ref(traceOutline(canvas));
    store.inputError = undefined;
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

/** Wer die 3D-Ansicht selbst dreht, beendet den Drehteller. */
export const stopAutoRotate = () => {
  store.autoRotate = false;
};

/**
 * Layoutwechsel per View Transition animieren, wo der Browser es kann. Dafür
 * muss React synchron rendern – wer `expanded` liest, abonniert es deshalb mit
 * `useSnapshot(store, { sync: true })`.
 */
export const toggleExpanded = () => {
  const toggle = () =>
    flushSync(() => {
      store.expanded = !store.expanded;
    });
  if (document.startViewTransition) document.startViewTransition(toggle);
  else toggle();
};

/** Ein Fenster geht auf bzw. zu – solange eins offen ist, scrollt die Seite nicht. */
export const dialogOpened = () => {
  store.dialogs += 1;
};

export const dialogClosed = () => {
  store.dialogs = Math.max(0, store.dialogs - 1);
};

/** Link mit der aktuellen Zeichnung. */
const currentHash = () =>
  writeHash({
    name: store.name,
    params: { ...store.params },
    drawing: store.drawing,
  });

/** Oben wird die Seite geteilt: ohne Sprachpfad, Empfänger landen in ihrer Sprache. */
export const pageUrl = () => `${window.location.origin}/`;

/** Unten die Kreation: Link mit Zeichnung, ebenfalls ohne Sprachpfad. */
export const creationUrl = () => `${window.location.origin}/${currentHash()}`;

/**
 * „x Kreationen erstellt“: Downloads und geteilte Kreationen zählen auf dem
 * Server mit; dieselbe Kreation nur einmal pro Sitzung.
 */
export const trackCreation = () => {
  countCreation(currentHash()).then((total) => {
    if (total !== null) store.creations = total;
  });
};

// ---------- Abgeleitetes ----------

/** Fehler zum Anzeigen: erst die Eingabe, dann der Ausstecher. */
export const useError = () => {
  const { inputError, cutter } = useSnapshot(store);
  return inputError ?? cutter.error;
};

/** Maßstab fürs Koordinatensystem: so viele mm ist die Zeichenfläche breit. */
export const useMmPerCanvas = () => {
  const { cutter, params } = useSnapshot(store);
  const { outline } = cutter;
  const { size } = params;
  return useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of outline) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    // Ohne Form: Annahme, dass die Zeichnung etwa 70 % der Fläche füllt.
    const extent = Math.max(maxX - minX, maxY - minY);
    return size / (extent > 0 ? extent : 0.7);
  }, [outline, size]);
};

// ---------- Nebenwirkungen ----------

/**
 * Verbindet den Store mit der Außenwelt; liefert das Aufräumen (für useEffect).
 * - Der Ausstecher entsteht in einem Web Worker, damit Zeichnen und Regler
 *   flüssig bleiben. Antworten auf veraltete Aufträge werden verworfen.
 * - Der Link in der Adresszeile folgt dem Zustand, damit er sich jederzeit
 *   teilen lässt – erst wenn sich eine Weile nichts tut.
 * - Der Zähler wird geladen, offene Fenster sperren das Scrollen.
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
      };
    } else store.cutter.error = "build";
  };
  const build = () => {
    // Kopie der Maße: Den Proxy selbst kann postMessage nicht klonen.
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

  // Änderungen kommen gebündelt an. Was sich geändert hat, zeigt der
  // Vergleich der Snapshots: Unveränderte Teile behalten ihre Identität.
  let last = snapshot(store);
  const unsubscribe = subscribe(store, () => {
    const next = snapshot(store);
    const changed = (key: keyof State) => next[key] !== last[key];
    if (changed("rings") || changed("params")) build();
    if (changed("name") || changed("params") || changed("drawing")) writeLink();
    if (changed("dialogs")) lockScroll();
    last = next;
  });

  build();
  writeLink();
  lockScroll();
  loadCreations().then((count) => {
    store.creations = count;
  });

  return () => {
    unsubscribe();
    clearTimeout(linkTimer);
    worker.terminate();
  };
};
