import { describe, expect, it } from "vitest";
import { buildSupplierLandscape } from "@/lib/providers/supplier-landscape";

describe("buildSupplierLandscape", () => {
  it("ranks suppliers and preserves origin rank/share", () => {
    const result = buildSupplierLandscape({
      destinationCode: 840,
      hsCode: "0901",
      year: 2025,
      totalImportValue: 1_000_000,
      originCode: 364,
      suppliers: [
        { countryCode: 156, country: "China", importValue: 500_000 },
        { countryCode: 364, country: "Iran", importValue: 150_000 },
        { countryCode: 826, country: "United Kingdom", importValue: 50_000 },
      ],
    });

    expect(result.status).toBe("partial");
    expect(result.origin.status).toBe("recorded");
    expect(result.origin.rank).toBe(2);
    expect(result.origin.share).toBe(15);
    expect(result.coverage.representedShare).toBe(70);
  });

  it("keeps missing origin evidence distinct from zero trade", () => {
    const result = buildSupplierLandscape({
      destinationCode: 840,
      hsCode: "0901",
      year: 2025,
      totalImportValue: 2_000_000,
      originCode: 364,
      suppliers: [
        { countryCode: 156, country: "China", importValue: 500_000 },
      ],
    });

    expect(result.origin.status).toBe("no_record");
    expect(result.origin.importValue).toBeNull();
    expect(result.coverage.representedShare).toBe(25);
    expect(result.status).toBe("partial");
  });
});
