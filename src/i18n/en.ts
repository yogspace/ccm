import type { de } from "./de";

export const en: typeof de = {
  title: "Cookie Cutter Maker – design and 3D-print your own cookie cutters",
  tagline: "Draw a shape or upload an SVG – get a print-ready cookie cutter.",
  language: "Language",
  unit: "Unit",
  steps: {
    shape: "Shape",
    cutter: "Cutter",
  },
  draw: {
    hint: "Draw an outline or drop an SVG here",
    hintSub: "Closed lines get filled.",
    brush: "Brush size",
    undo: "Undo",
    clear: "Clear",
    upload: "Upload SVG",
    drop: "Release to import",
    expand: "Enlarge canvas",
    shrink: "Shrink canvas",
  },
  preview: {
    empty: "Your cookie cutter will appear here.",
    loading: "Loading geometry engine …",
    rotate: "Rotate automatically",
  },
  params: {
    title: "Dimensions",
    size: "Size",
    bladeHeight: "Blade height",
    wall: "Wall",
    edge: "Cutting edge",
    taper: "Taper",
    flangeWidth: "Rim width",
    flangeHeight: "Rim height",
    smoothing: "Close gaps",
    reset: "Reset",
  },
  export: {
    name: "File name",
    namePlaceholder: "e.g. Heart",
    threeMf: "Download 3MF",
    stl: "STL",
  },
  hints: {
    title: "Printing tips",
    material: "PLA, 0.2 mm layer height",
    orientation: "Rim sits on the print bed",
    supports: "No supports needed",
    slicer: "Just import it into Bambu Studio",
    bambu:
      "If Bambu Studio says “invalid config”, just click OK – the geometry is complete. File → Import avoids the notice.",
  },
  share: {
    title: "Share",
    text: "Check out my cookie cutter – tweak it and download it as 3MF/STL:",
    copy: "Copy link",
    copied: "Copied",
    mail: "email",
    more: "More apps …",
    via: "Share via {{target}}",
    empty: "Draw a shape first",
  },
  legal: {
    close: "Close",
  },
  footer: {
    imprint: "Imprint & privacy",
  },
  errors: {
    engine: "The geometry engine could not be loaded.",
    build: "Couldn't create a cutter from this shape.",
    read: "The file could not be read.",
    invalidSvg: "Not a valid SVG file.",
    noCanvas: "Your browser does not support canvas.",
  },
};
