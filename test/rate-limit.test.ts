import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "../src/stats/rate-limit";

describe("rateLimit", () => {
  it("lets the limit through, stops the next, frees after the window", () => {
    const tooMany = rateLimit({ limit: 3, windowMs: 1000 });
    expect([0, 10, 20].map((t) => tooMany("a", t))).toEqual([
      false,
      false,
      false,
    ]);
    expect(tooMany("a", 30)).toBe(true);
    // Others are not affected.
    expect(tooMany("b", 30)).toBe(false);
    // Once the first request is a window old, there is room again.
    expect(tooMany("a", 1001)).toBe(false);
  });

  it("does not note requests over the limit", () => {
    const tooMany = rateLimit({ limit: 2, windowMs: 1000 });
    tooMany("a", 0);
    tooMany("a", 0);
    // Hammering while blocked must not push the release further out.
    for (let t = 1; t < 1000; t += 10) expect(tooMany("a", t)).toBe(true);
    expect(tooMany("a", 1000)).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first address the proxy passes on", () => {
    const request = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.2" },
    });
    expect(clientIp(request)).toBe("203.0.113.7");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
