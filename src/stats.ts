/**
 * The “x creations made” counter via the mini API (api/server.mjs). If it is
 * unreachable (e.g. in a dev server without the API), there is simply no number.
 */

const SEEN_KEY = "ccm.counted";

/** Short fingerprint of a creation (FNV-1a), so it counts only once per session. */
const fingerprint = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const seen = (): string[] => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const readCount = async (response: Response) => {
  if (!response.ok) return null;
  const data: unknown = await response.json();
  const creations = (data as { creations?: unknown }).creations;
  return typeof creations === "number" ? creations : null;
};

export const loadCreations = async () => {
  try {
    return await readCount(await fetch("/api/stats"));
  } catch {
    return null;
  }
};

/**
 * Counts a creation (download or share). `key` describes it, e.g. the link
 * hash – the same creation counts only once per session. Returns the new total
 * or `null`.
 */
export const countCreation = async (key: string) => {
  const id = fingerprint(key);
  const known = seen();
  if (known.includes(id)) return null;
  try {
    sessionStorage.setItem(
      SEEN_KEY,
      JSON.stringify([...known, id].slice(-200))
    );
  } catch {
    // Without storage it simply counts more often – no problem.
  }
  try {
    return await readCount(
      await fetch("/api/stats/creation", { method: "POST" })
    );
  } catch {
    return null;
  }
};
