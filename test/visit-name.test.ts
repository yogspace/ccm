import { describe, expect, it } from "vitest";
import { countryFlag, visitName } from "../src/stats/visit-name";

describe("visitName", () => {
  it("is stable for the same id", () => {
    expect(visitName("d599860705f34c4e")).toBe(visitName("d599860705f34c4e"));
  });

  it("is an adjective and an animal", () => {
    expect(visitName("5fa9c4b8156c42b8")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("spreads ids over many names", () => {
    const names = new Set(
      Array.from({ length: 500 }, (_, i) =>
        visitName(i.toString(16).padStart(16, "0"))
      )
    );
    expect(names.size).toBeGreaterThan(300);
  });
});

describe("countryFlag", () => {
  it("turns a country code into its flag", () => {
    expect(countryFlag("DE")).toBe("🇩🇪");
  });

  it("is empty for anything else", () => {
    expect(countryFlag("xx")).toBe("");
    expect(countryFlag("")).toBe("");
  });
});
