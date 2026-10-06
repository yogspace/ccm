/** Filament colours of the 3D views – every new cutter gets a different one. */
export const FILAMENTS = [
  "#2a44ff", // Luminous Blue
  "#ff6a1f", // Energy Orange
  "#ff5fa8", // Pop Pink
  "#5fb36b", // Meadowland Green
  "#c4825f", // Clay
  "#ffc31f",
  "#13b0a5",
];

/**
 * A colour that follows from a text (e.g. the drawing in a link) – the same
 * on every screen, so sender and recipient see the same cutter.
 */
export const filamentFor = (key: string) => {
  let value = 0;
  for (const char of key) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return FILAMENTS[value % FILAMENTS.length];
};
