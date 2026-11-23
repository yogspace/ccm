import type { ActionName } from "./stats/actions";
import { TRACKING } from "./stats/config";

/**
 * Anonymous statistics from the browser: a page view per load, and the
 * actions that matter (downloads, sharing, cards …). Only the page and the
 * referrer are sent – the server boils them down to coarse groups (see
 * collections/page-views.ts). Never the drawing, a name or a message.
 *
 * With the options in stats/config.ts also: a random visit id, kept ONLY in
 * this module's memory (no cookie, no storage – a reload or a new tab starts
 * a new visit), the step within the visit and the campaign of the first
 * page. (`timing` is not wired up here: it needs the skill's time beacon
 * and its /next/track/end route.)
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

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** This page load's visit – gone with the page. */
const visit = TRACKING.visits ? randomId() : null;
let step = 0;

/** The path counted last – React's development double effects count once. */
let counted: string | null = null;

const campaign = () => {
  const query = new URLSearchParams(window.location.search);
  const parts = ["utm_source", "utm_medium", "utm_campaign"].map(
    (key) => query.get(key)?.trim().slice(0, 60) ?? ""
  );
  return parts.some(Boolean) ? parts : null;
};

/**
 * A page view – once per page load (editor.tsx, card/card-entry.tsx). Each
 * one is the next step of this load's visit.
 */
export const trackView = () => {
  const path = window.location.pathname;
  if (path === counted) return;
  counted = path;
  step += 1;
  send("/next/track", {
    path,
    // After client-side navigation document.referrer still names where the
    // visit came from – the later pages are internal.
    ref: step === 1 ? document.referrer : window.location.origin,
    ...(visit && { visit, step }),
    ...(TRACKING.campaigns && step === 1 ? { campaign: campaign() } : {}),
  });
};

export const trackEvent = (name: ActionName) =>
  send("/next/action", { name, path: window.location.pathname });
