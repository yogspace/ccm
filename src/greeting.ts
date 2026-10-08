/**
 * A creation sent as a greeting card: its own page (/de/card) with the cutter in
 * the middle, the message running around it and the files to download. Like
 * every link, everything lives in the hash – the creation as usual, plus who
 * it is for, who it is from and the message. Nothing is stored.
 */

export type Greeting = {
  to: string;
  from: string;
  message: string;
  /**
   * The favourite colour: its number in the CMS's list (“Site” global → Card
   * colours) – short in the link; 0, the first, is the default.
   */
  color: number;
};

/** Longest names and message (characters) – the message has to fit the ring. */
export const GREETING_LIMITS = { name: 32, message: 140 } as const;

/** The card's parts in the link's hash (glaze.ts reads the colour too). */
export const GREETING_KEYS = {
  to: "to",
  from: "from",
  message: "m",
  color: "c",
} as const;

const KEYS = GREETING_KEYS;

/**
 * Link to the card for a creation's hash (`#n=…&s=…`) – in the sender's
 * language, which the message is written in too: `/de/card#…`. The words
 * first, readable in the link; the creation after them, its shape – long
 * and unreadable – last.
 */
export const greetingUrl = (
  creationHash: string,
  greeting: Greeting,
  lang: string
) => {
  const query = new URLSearchParams();
  for (const field of ["to", "from", "message"] as const) {
    const value = greeting[field].trim();
    if (value) query.set(KEYS[field], value);
  }
  if (greeting.color > 0) query.set(KEYS.color, String(greeting.color));
  const creation = new URLSearchParams(creationHash.replace(/^#/, ""));
  const shape = creation.get("s");
  creation.delete("s");
  for (const [key, value] of creation) query.append(key, value);
  if (shape) query.set("s", shape);
  return `${window.location.origin}/${lang}/card#${query}`;
};

export const readGreeting = (hash: string): Greeting => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const read = (key: string, limit: number) =>
    (query.get(key) ?? "").trim().slice(0, limit);
  return {
    to: read(KEYS.to, GREETING_LIMITS.name),
    from: read(KEYS.from, GREETING_LIMITS.name),
    message: read(KEYS.message, GREETING_LIMITS.message),
    color: Math.max(0, Math.floor(Number(query.get(KEYS.color))) || 0),
  };
};
