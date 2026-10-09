import { scrypt } from "node:crypto";

/**
 * A passphrase's key – what the database keeps of it, and finds an account
 * by: scrypt, peppered with the server's secret. Apart from server.ts, so
 * the accounts collection (its admin search) can use it without loading the
 * Payload config it belongs to.
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
