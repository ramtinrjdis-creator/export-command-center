import { describe, expect, it } from "vitest";
import { buildSupplierLandscape } from "../providers/supplier-landscape";

describe("supplier landscape", () => {
  it("ranks suppliers deterministically and calculates shares", () => {
    const result = buildSupplierLandscape({
      destinationCode: 842,
      hsCode: "090111",
      year: 2024,
      totalImportValue: 1000,
      suppliers: [
        { countryCode: 100, country: "Country A", importValue: 600 },
        { countryCode: 200, country: "Country B", importValue: 300 },
        { countryCode: 300, country: "Country C", importValue: 100 },
      ],
      originCode: 200,
    });

    expect(result.status).toBe("supported");
    expect(result.suppliers).toHaveLength(3);

    expect(result.suppliers[0].countryCode).toBe(100);
    expect(result.suppliers[0].rank).toBe(1);
    expect(result.suppliers[0].share).toBe(60);

    expect(result.origin.status).toBe("recorded");
    expect(result.origin.importValue).toBe(300);
    expect(result.origin.share).toBe(30);
    expect(result.origin.rank).toBe(2);

    expect(result.coverage.representedShare).toBe(100);
  });

  it("does not convert missing origin data into zero trade", () => {
    const result = buildSupplierLandscape({
      destinationCode: 842,
      hsCode: "090111",
      year: 2024,
      totalImportValue: 1000,
      suppliers: [
        { countryCode: 100, country: "Country A", importValue: 1000 },
      ],
      originCode: 364,
    });

    expect(result.origin.status).toBe("no_record");
    expect(result.origin.importValue).toBeNull();
    expect(result.origin.share).toBeNull();
    expect(result.origin.rank).toBeNull();
  });

  it("marks incomplete supplier coverage as partial", () => {
    const result = buildSupplierLandscape({
      destinationCode: 842,
      hsCode: "090111",
      year: 2024,
      totalImportValue: 1000,
      suppliers: [
        { countryCode: 100, country: "Country A", importValue: 700 },
      ],
    });

    expect(result.status).toBe("partial");
    expect(result.coverage.representedShare).toBe(70);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("does not fabricate shares when total import value is missing", () => {
    const result = buildSupplierLandscape({
      destinationCode: 842,
      hsCode: "090111",
      year: 2024,
      totalImportValue: null,
      suppliers: [
        { countryCode: 100, country: "Country A", importValue: 700 },
      ],
    });

    expect(result.status).toBe("partial");
    expect(result.suppliers[0].share).toBe(0);
    expect(result.coverage.representedShare).toBeNull();
  });

  it("returns unavailable when there are no usable supplier records", () => {
    const result = buildSupplierLandscape({
      destinationCode: 842,
      hsCode: "090111",
      year: 2024,
      totalImportValue: 1000,
      suppliers: [],
      originCode: 364,
    });

    expect(result.status).toBe("unavailable");
    expect(result.suppliers).toHaveLength(0);
    expect(result.origin.status).toBe("no_record");
  });
});
