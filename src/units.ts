export type Unit = "mm" | "in";

export const units: Unit[] = ["mm", "in"];

const STORAGE_KEY = "ccm.unit";
const MM_PER_INCH = 25.4;

/** Gespeicherte Wahl, sonst mm. */
export const initialUnit = (): Unit => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "mm" || stored === "in") return stored;
  } catch {
    // Ohne Storage (privater Modus o. Ä.) gilt der Standard.
  }
  return "mm";
};

export const storeUnit = (unit: Unit) => {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Nicht schlimm, dann gilt beim nächsten Mal wieder der Standard.
  }
};

const formats = new Map<string, Intl.NumberFormat>();

/** Zahlenformate sind teuer anzulegen – daher je Sprache und Stellen nur einmal. */
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

/** Formatiert eine Länge in mm für die Anzeige in der gewählten Einheit. */
export const formatLength = (
  mm: number,
  unit: Unit,
  locale: string | undefined,
  fractionDigits = unit === "in" ? 2 : 1
) =>
  `${numberFormat(locale, fractionDigits).format(unit === "in" ? mm / MM_PER_INCH : mm)} ${unit}`;
