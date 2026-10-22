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

/** The name alone as a file name, without extension: `herz-fuer-oma`. */
export const nameBase = (name: string) => slugify(name) || "cookie-cutter";

/** File name without extension: `herz-fuer-oma-80mm`. */
export const fileBase = (name: string, size: number) =>
  `${nameBase(name)}-${Math.round(size)}mm`;
