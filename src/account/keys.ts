import { randomInt, scrypt } from "node:crypto";
import { PASSPHRASE_NUMBER, PASSPHRASE_WORDS } from "./rules";
import { WORDS } from "./words";

/**
 * Passphrases – made here – and their keys, what the database keeps of them
 * and finds an account by: scrypt, peppered with the server's secret. Apart
 * from server.ts, so the accounts collection (its admin tools) can use them
 * without loading the Payload config it belongs to.
 */

export const secret = () => {
  const value = process.env.PAYLOAD_SECRET;
  if (!value) throw new Error("PAYLOAD_SECRET is not set");
  return value;
};

/**
 * As typed – upper case, spaces, commas, the number stuck to a word
 * (`marder42`) – the same passphrase.
 */
export const normalizePassphrase = (phrase: string) =>
  phrase
    .normalize("NFKC")
    .toLowerCase()
    .replace(/([a-z])(\d)|(\d)([a-z])/g, "$1$3-$2$4")
    .split(/[^a-z\d]+/)
    .filter(Boolean)
    .join("-");

/** The key an account is found by – slow on purpose (about 50 ms). */
export const keyOf = (phrase: string) =>
  new Promise<string>((resolve, reject) => {
    scrypt(
      normalizePassphrase(phrase),
      `ccm-account:${secret()}`,
      32,
      { N: 2 ** 14, r: 8, p: 1 },
      (error, key) => (error ? reject(error) : resolve(key.toString("hex")))
    );
  });

/**
 * A fresh passphrase in the visitor's language: three words, hyphenated,
 * each by chance with a number – one at least, or the weakest ones (no
 * number) would be tried first: `kuh7-traktor-waffel21`.
 */
export const newPassphrase = (lang: string) => {
  const words = lang === "de" ? WORDS.de : WORDS.en;
  let numbered: boolean[];
  do {
    numbered = Array.from({ length: PASSPHRASE_WORDS }, () => randomInt(2) > 0);
  } while (!numbered.includes(true));
  const [from, to] = PASSPHRASE_NUMBER;
  return numbered
    .map(
      (number) =>
        words[randomInt(words.length)] + (number ? randomInt(from, to + 1) : "")
    )
    .join("-");
};
