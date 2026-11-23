import type { CityResponse, Reader } from "maxmind";

/**
 * Country, region and city from the IP in a local GeoIP database – for
 * servers without a CDN that sends location headers (stats/location.ts).
 * The IP stays in memory for the lookup; nothing about it is stored or sent
 * anywhere.
 *
 * Needs the `maxmind` package and a database in MMDB format, its path in
 * GEOIP_DB. scripts/geoip-download.sh fetches DB-IP IP to Country Lite
 * (CC BY 4.0, monthly) – country only, the recommended default – or, with
 * `city`, IP to City Lite. MaxMind GeoLite2 (free account, attribution
 * required) works the same. A country database simply has no region and
 * city. Without GEOIP_DB every lookup is null.
 *
 * The dynamic import is bundled by Turbopack and works as it is.
 */
export type GeoHit = {
  country?: string;
  region?: string;
  city?: string;
};

let reader: Promise<Reader<CityResponse> | null> | null = null;

const open = () => {
  reader ??= (async () => {
    const path = process.env.GEOIP_DB;
    if (!path) return null;
    try {
      const maxmind = await import("maxmind");
      // Reopened when the file is replaced (an update).
      return await maxmind.open<CityResponse>(path, { watchForUpdates: true });
    } catch (error) {
      console.error("[geoip] could not open the database:", error);
      return null;
    }
  })();
  return reader;
};

export const geoLookup = async (ip: string): Promise<GeoHit | null> => {
  const db = await open();
  if (!db || !ip || ip === "unknown") return null;
  try {
    const hit = db.get(ip);
    if (!hit) return null;
    return {
      country: hit.country?.iso_code,
      region: hit.subdivisions?.[0]?.names?.en,
      city: hit.city?.names?.en,
    };
  } catch {
    // Not an IP the database knows (private ranges, malformed).
    return null;
  }
};
