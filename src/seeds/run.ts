import type { Payload } from "payload";
import { seedLegal, seedSite } from "../legal/seed";
import { syncTranslations } from "../translations/seed";
import type { SeedKey } from "./definitions";

/** Each seed, run – its summary for the admin. */
const runners: Record<
  SeedKey,
  (payload: Payload, replace: boolean) => Promise<string>
> = {
  translations: async (payload) => {
    const { added, removed, kept } = await syncTranslations(payload);
    return `${added.length} added, ${removed.length} removed, ${kept} kept`;
  },
  site: async (payload, replace) =>
    (await seedSite(payload, replace ? "replace" : "fill")) === "set"
      ? "Links and address set"
      : "Already there – kept",
  legal: async (payload, replace) => {
    const results = await seedLegal(payload, replace ? "replace" : "fill");
    return Object.entries(results)
      .map(([locale, result]) => `${locale.toUpperCase()} ${result}`)
      .join(", ");
  },
};

export const runSeed = (key: SeedKey, payload: Payload, replace: boolean) =>
  runners[key](payload, replace);
