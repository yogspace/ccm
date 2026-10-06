/** “Herz für Oma” → “herz-fuer-oma” */
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** File name without extension: `herz-fuer-oma-80mm`. */
export const fileBase = (name: string, size: number) =>
  `${slugify(name) || "cookie-cutter"}-${Math.round(size)}mm`;
