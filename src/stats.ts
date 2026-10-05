/**
 * Zähler „x Kreationen erstellt“ über die Mini-API (api/server.mjs). Ist sie
 * nicht erreichbar (z. B. im Dev-Server ohne API), gibt es einfach keine Zahl.
 */

const SEEN_KEY = "ccm.counted";

/** Kurzer Fingerabdruck einer Kreation (FNV-1a), damit sie pro Sitzung nur einmal zählt. */
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
 * Zählt eine Kreation (Download oder Teilen). `key` beschreibt sie, z. B. der
 * Link-Hash – dieselbe Kreation zählt pro Sitzung nur einmal. Liefert die neue
 * Summe oder `null`.
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
    // Ohne Storage zählt es eben öfter – kein Problem.
  }
  try {
    return await readCount(
      await fetch("/api/stats/creation", { method: "POST" })
    );
  } catch {
    return null;
  }
};
