/**
 * A creation sent as a greeting card: its own page (/card/) with the cutter in
 * the middle, the message running around it and the files to download. Like
 * every link, everything lives in the hash – the creation as usual, plus who
 * it is for, who it is from and the message. Nothing is stored.
 */

export type Greeting = { to: string; from: string; message: string };

/** Longest names and message (characters) – the message has to fit the ring. */
export const GREETING_LIMITS = { name: 32, message: 140 } as const;

const KEYS = { to: "to", from: "from", message: "m" } as const;

/**
 * Link to the card for a creation's hash (`#n=…&s=…`) – in the sender's
 * language, which the message is written in too: `/de/card/#…`.
 */
export const greetingUrl = (
  creationHash: string,
  greeting: Greeting,
  lang: string
) => {
  const query = new URLSearchParams(creationHash.replace(/^#/, ""));
  for (const field of ["to", "from", "message"] as const) {
    const value = greeting[field].trim();
    if (value) query.set(KEYS[field], value);
  }
  return `${window.location.origin}/${lang}/card/#${query}`;
};

export const readGreeting = (hash: string): Greeting => {
  const query = new URLSearchParams(hash.replace(/^#/, ""));
  const read = (key: string, limit: number) =>
    (query.get(key) ?? "").trim().slice(0, limit);
  return {
    to: read(KEYS.to, GREETING_LIMITS.name),
    from: read(KEYS.from, GREETING_LIMITS.name),
    message: read(KEYS.message, GREETING_LIMITS.message),
  };
};
