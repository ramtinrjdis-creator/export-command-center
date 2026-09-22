import { describe, expect, it } from "vitest";
import { buildBuyerResearch } from "../buyer-research";

describe("buildBuyerResearch", () => {
  it("builds targeted free research queries", () => {
    const result = buildBuyerResearch({ product: "Coffee", hsCode: "0901", market: "United States" });
    expect(result.mode).toBe("free-research");
    expect(result.queries[0]).toContain("Coffee");
    expect(result.queries[0]).toContain("United States");
    expect(result.queries[0]).toContain("0901");
    expect(result.links).toHaveLength(3);
  });

  it("encodes search links safely", () => {
    const result = buildBuyerResearch({ product: "Coffee & Beans", hsCode: "0901", market: "United States" });
    expect(result.links[0].url).toContain("%26");
  });

  it("resolves market and product context without placeholders", () => {
    const result = buildBuyerResearch({
      product: "",
      hsCode: "090111",
      market: "",
      marketCode: 840,
    });

    expect(result.market).toBe("United States");
    expect(result.queries[0]).toContain("Coffee");
    expect(result.queries[0]).toContain("United States");
    expect(result.queries[0]).not.toContain('"product"');
    expect(result.queries[0]).not.toContain('"Target market"');
    expect(result.links[0].url).toContain("Coffee");
  });

  it("falls back to an explicit HS and country code instead of placeholders", () => {
    const result = buildBuyerResearch({
      product: "",
      hsCode: "999999",
      market: "",
      marketCode: 999,
    });

    expect(result.market).toBe("country code 999");
    expect(result.queries[0]).toContain("HS 999999");
    expect(result.queries[0]).not.toContain('"product"');
    expect(result.queries[0]).not.toContain('"Target market"');
  });

});
