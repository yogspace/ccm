import { describe, expect, it } from "vitest";
import { unusedIn } from "../src/translations/seed";

const keys = [
  "draw.presets",
  "card.ring",
  "errors.network",
  "card.picture.save",
];

describe("unusedIn", () => {
  it("finds keys and groups the code no longer has, keeps the rest", () => {
    const doc = {
      _id: "x",
      globalType: "translations",
      updatedAt: "2026-10-08",
      draw: { presets: { de: "Vorlagen", en: "Templates" } },
      card: {
        ring: { de: "Ring", en: "Ring" },
        // removed key in a group that stays
        back: { de: "Zurück", en: "Back" },
        // a group whose one key stays, another goes
        // (`save` is reserved too: stored as `save_`)
        picture: { save_: { de: "S", en: "S" }, share: { de: "T", en: "T" } },
      },
      // a reserved name is stored with an underscore
      errors_: { network: { de: "Netz", en: "Net" } },
      // a whole group the code no longer has
      old: { thing: { de: "a", en: "a" } },
    };
    expect(unusedIn(doc, keys).sort()).toEqual(
      ["card.back", "card.picture.share", "old"].sort()
    );
  });

  it("finds nothing when all is in use", () => {
    expect(
      unusedIn(
        { globalType: "translations", card: { ring: { de: "R", en: "R" } } },
        keys
      )
    ).toEqual([]);
  });
});
