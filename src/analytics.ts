import type { ActionName } from "./stats/actions";

/**
 * Anonymous statistics from the browser: a page view per load, and the
 * actions that matter (downloads, sharing, cards …). Only the page and the
 * referrer are sent – the server boils them down to coarse groups (see
 * collections/page-views.ts). Never the drawing, a name or a message.
 *
 * sendBeacon survives leaving the page (a download link, “open card”);
 * fetch with keepalive is the fallback. Statistics must never break the page.
 */
const send = (url: string, body: object) => {
  try {
    const data = new Blob([JSON.stringify(body)], {
      type: "application/json",
    });
    if (navigator.sendBeacon?.(url, data)) return;
    fetch(url, { method: "POST", body: data, keepalive: true }).catch(
      () => undefined
    );
  } catch {
    // Nothing to do – the page goes on.
  }
};

export const trackView = () =>
  send("/next/track", {
    path: window.location.pathname,
    ref: document.referrer,
  });

export const trackEvent = (name: ActionName) =>
  send("/next/action", { name, path: window.location.pathname });
