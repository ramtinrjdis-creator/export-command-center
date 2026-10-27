import { describe, expect, it } from "vitest";
import {
  parseSupplierQuery,
} from "@/app/api/suppliers/route";

describe("supplier API contract", () => {
  it("accepts a valid Comtrade destination code", () => {
    const params =
      new URLSearchParams({
        market: "156",
        hsCode: "090111",
        year: "2024",
        origin: "840",
        limit: "5",
      });

    const result =
      parseSupplierQuery(
        params,
      );

    expect(result.ok).toBe(
      true,
    );

    if (result.ok) {
      expect(
        result.value.market,
      ).toBe(156);

      expect(
        result.value.hsCode,
      ).toBe("090111");

      expect(
        result.value.year,
      ).toBe(2024);

      expect(
        result.value.origin,
      ).toBe(840);

      expect(
        result.value.limit,
      ).toBe(5);
    }
  });

  it("rejects an invalid market", () => {
    const params =
      new URLSearchParams({
        market: "USA",
        hsCode: "090111",
        year: "2024",
      });

    const result =
      parseSupplierQuery(
        params,
      );

    expect(result.ok).toBe(
      false,
    );
  });

  it("rejects an invalid HS code", () => {
    const params =
      new URLSearchParams({
        market: "156",
        hsCode: "ABC",
        year: "2024",
      });

    const result =
      parseSupplierQuery(
        params,
      );

    expect(result.ok).toBe(
      false,
    );
  });

  it("clamps supplier limit to the supported maximum", () => {
    const params =
      new URLSearchParams({
        market: "156",
        hsCode: "090111",
        year: "2024",
        limit: "999",
      });

    const result =
      parseSupplierQuery(
        params,
      );

    expect(result.ok).toBe(
      true,
    );

    if (result.ok) {
      expect(
        result.value.limit,
      ).toBe(25);
    }
  });

  it("uses the current supported default year", () => {
    const params =
      new URLSearchParams({
        market: "156",
        hsCode: "090111",
      });

    const result =
      parseSupplierQuery(
        params,
      );

    expect(result.ok).toBe(
      true,
    );

    if (result.ok) {
      expect(
        result.value.year,
      ).toBe(2025);
    }
  });
});
