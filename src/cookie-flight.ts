/**
 * A cookie on its way into the cookie bar: the button that baked it says
 * where it starts (and which cookie it is), the bar flies it to its place.
 * A tiny event channel – the two components sit far apart in the tree.
 */
export type Launch = {
  /** Where it starts: the cookie on the button, in viewport coordinates. */
  from: DOMRect;
  /** The cookie's hash in the jar. */
  hash: string;
  id: number;
};

const listeners = new Set<(launch: Launch) => void>();

export const launchCookie = (from: DOMRect, hash: string) => {
  const launch = { from, hash, id: performance.now() };
  for (const listener of listeners) listener(launch);
};

export const onCookieLaunch = (listener: (launch: Launch) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The cookie on a button – where a flight starts. */
export const launchSpot = (button: HTMLElement) =>
  (button.querySelector("[data-cookie]") ?? button).getBoundingClientRect();
