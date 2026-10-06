export type Unit = "mm" | "in";

export const units: Unit[] = ["mm", "in"];

const STORAGE_KEY = "ccm.unit";
const MM_PER_INCH = 25.4;

/** The stored choice, otherwise mm. */
export const initialUnit = (): Unit => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mm" || stored === "in") return stored;
  } catch {
    // Without storage (private mode and the like) the default applies.
  }
  return "mm";
};

export const storeUnit = (unit: Unit) => {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // No harm – next time the default applies again.
  }
};

const formats = new Map<string, Intl.NumberFormat>();

/** Number formats are expensive to create – so only once per language and digits. */
export const numberFormat = (
  locale: string | undefined,
  maximumFractionDigits: number
) => {
  const key = `${locale}:${maximumFractionDigits}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { maximumFractionDigits });
    formats.set(key, format);
  }
  return format;
};

/** Formats a length in mm for display in the chosen unit. */
export const formatLength = (
  mm: number,
  unit: Unit,
  locale: string | undefined,
  fractionDigits = unit === "in" ? 2 : 1
) =>
  `${numberFormat(locale, fractionDigits).format(unit === "in" ? mm / MM_PER_INCH : mm)} ${unit}`;
