import { readGreeting } from "../greeting";
import { isEmptyDrawing, readHash } from "../url-state";

/**
 * The card as its link brings it – read once, the hash does not change on
 * this page: the creation (its drawing and dimensions) and the greeting.
 */
const hash = window.location.hash;
export const shared = readHash(hash);
export const greeting = readGreeting(hash);
/** Whether the link brings a shape at all. */
export const hasShape =
  shared.rings.length > 0 || !isEmptyDrawing(shared.drawing);

/** Asked to move less: no sprinkles, no swinging, nothing leaning. */
export const still = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
