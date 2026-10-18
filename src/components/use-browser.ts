import { useSyncExternalStore } from "react";

/**
 * What only the browser knows, for a page rendered on the server: there it
 * is never so, in the browser once the page is taken over (hydrated) –
 * both render the same first, then the browser's own follows.
 */

const never = () => () => {};

/** Whether the page runs in the browser yet. */
export const useMounted = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false
  );

/** Whether a media query matches – following it when it changes. */
export const useMedia = (query: string) =>
  useSyncExternalStore(
    (changed) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", changed);
      return () => media.removeEventListener("change", changed);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
