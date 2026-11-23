import { geoLookup } from "./geoip";

/**
 * Where a visitor is, coarsely (`TRACKING.origin`): country, region and
 * city – never the IP, never coordinates.
 *
 * First from headers a CDN or proxy sets from the IP – Cloudflare (country
 * always; region and city with the “Add visitor location headers” managed
 * transform), Vercel, or the own proxy (`x-geo-*`). Without any of them a
 * lookup in a local GeoIP database (stats/geoip.ts) – the IP is read only in
 * memory for it and dropped right after.
 */
export type Location = {
  /** ISO 3166-1 alpha-2: “DE”. */
  country: string | null;
  /** “Bavaria” – or its code (“BY”) where only that is sent. */
  region: string | null;
  city: string | null;
};

const header = (headers: Headers, names: string[]) => {
  for (const name of names) {
    const raw = headers.get(name)?.trim();
    if (!raw) continue;
    // Vercel sends city names URL-encoded (“M%C3%BCnchen”).
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // Not encoded – as it is.
    }
    if (value.length <= 80) return value;
  }
  return null;
};

const cleanCountry = (value: string | null | undefined) => {
  const code = value?.trim().toUpperCase();
  // XX: unknown, T1: Tor (Cloudflare).
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1"
    ? code
    : null;
};

export const locationOf = async (
  headers: Headers,
  ip: string
): Promise<Location> => {
  const country = cleanCountry(
    header(headers, ["cf-ipcountry", "x-vercel-ip-country", "x-geo-country"])
  );
  if (country) {
    return {
      country,
      region: header(headers, [
        "cf-region",
        "x-vercel-ip-country-region",
        "x-geo-region",
      ]),
      city: header(headers, ["cf-ipcity", "x-vercel-ip-city", "x-geo-city"]),
    };
  }
  const found = await geoLookup(ip);
  return {
    country: cleanCountry(found?.country),
    region: found?.region?.slice(0, 80) || null,
    city: found?.city?.slice(0, 80) || null,
  };
};
