/**
 * Short links: a link's model (`s`, long) can stand on the server under a
 * code (`k`, account/rules.ts) – the rest of the link stays as it is. Opened,
 * it becomes the full link again before the page reads it: whoever got it
 * keeps a link that works for good, even once the account is gone.
 */

let missing = false;

/** The link's code led nowhere – its model was deleted (or never was). */
export const shortShapeMissing = () => missing;

/**
 * Turns a short link into the full one – the model fetched for its `k` –
 * before anything reads the link (editor-root.tsx, card-root.tsx). Without
 * `k`, or with `s` too, nothing to do.
 */
export const resolveShortShape = async () => {
  const query = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = query.get("k");
  if (!code || query.has("s")) return;
  try {
    const response = await fetch(`/next/shape/${encodeURIComponent(code)}`);
    const { shape } = response.ok ? await response.json() : {};
    if (typeof shape !== "string") throw new Error("No shape");
    // The model last, as in every link.
    query.delete("k");
    query.set("s", shape);
    const { pathname, search } = window.location;
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${search}#${query}`
    );
  } catch {
    missing = true;
  }
};

/** The link with its model stood in for by `code` – the rest as it was. */
export const shortened = (url: string, code: string) => {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  query.delete("s");
  query.set("k", code);
  return `${parsed.origin}${parsed.pathname}#${query}`;
};

/** The model a link carries (`s`) – what a short link keeps. */
export const shapeOf = (url: string) => {
  try {
    return new URLSearchParams(new URL(url).hash.replace(/^#/, "")).get("s");
  } catch {
    return null;
  }
};
