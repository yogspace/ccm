import type { CutterParams } from "./geometry/cutter";

/**
 * The dimensions' keys in a link (url-state.ts) – a letter each, in the
 * order they are written. Taken already: `n` (name), `s` (drawing), `k`
 * (short link code) and the card's `t`, `f`, `m`, `c` (greeting.ts). Older
 * links spell them out (`bladeHeight=…`) – still read, no longer written.
 */
export const PARAM_KEYS: Record<keyof CutterParams, string> = {
  size: "z",
  bladeHeight: "h",
  wall: "w",
  edge: "e",
  taper: "p",
  flangeWidth: "l",
  flangeHeight: "d",
  smoothing: "g",
  cutouts: "i",
  bridgeWidth: "b",
  mirror: "x",
  relief: "r",
};

export const paramKeys = Object.keys(PARAM_KEYS) as (keyof CutterParams)[];

/** A dimension's value in a link – under its letter, or its old name. */
export const paramOf = (query: URLSearchParams, key: keyof CutterParams) =>
  query.get(PARAM_KEYS[key]) ?? query.get(key);

/**
 * A link's hash as it is written today: the dimensions under their letters,
 * the drawing as it was. Cookies saved from older links (in the browser, in
 * an account) still match the same creation opened again.
 */
export const currentForm = (hash: string) => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const out = new URLSearchParams();
  const name = query.get("n");
  if (name) out.set("n", name);
  for (const key of paramKeys) {
    const value = paramOf(query, key);
    if (value !== null) out.set(PARAM_KEYS[key], value);
  }
  const known = new Set<string>([
    "n",
    "s",
    ...paramKeys,
    ...paramKeys.map((key) => PARAM_KEYS[key]),
  ]);
  for (const [key, value] of query) {
    if (!known.has(key)) out.append(key, value);
  }
  // The drawing last, as in every link.
  const shape = query.get("s");
  if (shape) out.set("s", shape);
  return out.size > 0 ? `#${out}` : "";
};
