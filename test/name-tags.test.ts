import { describe, expect, it } from "vitest";
import { nameTags } from "../src/export/name-tags";

describe("nameTags", () => {
  it("gives what is named and what goes with it", () => {
    expect(nameTags("Skull")).toEqual([
      "skull",
      "skeleton",
      "halloween",
      "spooky",
    ]);
    expect(nameTags("Big Heart")).toEqual(["heart", "love", "valentine"]);
  });

  it("finds longer keys inside other words, plurals too", () => {
    expect(nameTags("Snowflakes")).toEqual([
      "snowflake",
      "snow",
      "winter",
      "christmas",
    ]);
    expect(nameTags("Gingerbreadman")).toEqual([
      "gingerbread",
      "christmas",
      "baking",
    ]);
  });

  it("merges the tags of several hits, each once", () => {
    expect(nameTags("Cat and Dog")).toEqual(["cat", "pet", "animal", "dog"]);
  });

  it("takes short and marked keys only as whole words", () => {
    expect(nameTags("Catherine")).toEqual([]);
    expect(nameTags("Planet")).toEqual(["planet", "space"]);
    expect(nameTags("Crown")).toEqual(["crown", "royal", "king"]);
    expect(nameTags("Glove")).toEqual(["glove", "winter"]);
    expect(nameTags("Basketball")).toEqual(["basketball", "sports"]);
    expect(nameTags("Dandelion")).toEqual([
      "flower",
      "flowers",
      "spring",
      "garden",
    ]);
  });

  it("finds nothing in a name it doesn't know", () => {
    expect(nameTags("Meso")).toEqual([]);
  });
});
