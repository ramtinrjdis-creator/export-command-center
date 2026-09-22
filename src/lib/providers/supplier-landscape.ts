export type SupplierLandscapeStatus =
  | "supported"
  | "partial"
  | "unavailable";

export type SupplierRecord = {
  countryCode: number;
  country: string;
  importValue: number;
  share: number;
  rank: number;
};

export type SupplierLandscape = {
  status: SupplierLandscapeStatus;
  destinationCode: number;
  hsCode: string;
  year: number;
  totalImportValue: number | null;
  suppliers: SupplierRecord[];
  origin: {
    status: "recorded" | "no_record" | "not_checked" | "unavailable";
    countryCode: number | null;
    importValue: number | null;
    share: number | null;
    rank: number | null;
  };
  coverage: {
    supplierCount: number;
    representedValue: number;
    representedShare: number | null;
  };
  limitations: string[];
};

export type SupplierInput = {
  countryCode: number;
  country: string;
  importValue: number;
};

export function buildSupplierLandscape(input: {
  destinationCode: number;
  hsCode: string;
  year: number;
  suppliers: SupplierInput[];
  totalImportValue: number | null;
  originCode?: number | null;
}): SupplierLandscape {
  const validSuppliers = input.suppliers
    .filter(
      (supplier) =>
        Number.isInteger(supplier.countryCode) &&
        supplier.countryCode > 0 &&
        typeof supplier.country === "string" &&
        supplier.country.trim().length > 0 &&
        Number.isFinite(supplier.importValue) &&
        supplier.importValue > 0,
    )
    .map((supplier) => ({
      ...supplier,
      country: supplier.country.trim(),
    }))
    .sort((a, b) => b.importValue - a.importValue);

  const representedValue = validSuppliers.reduce(
    (sum, supplier) => sum + supplier.importValue,
    0,
  );

  const total =
    typeof input.totalImportValue === "number" &&
    Number.isFinite(input.totalImportValue) &&
    input.totalImportValue > 0
      ? input.totalImportValue
      : null;

  const suppliers: SupplierRecord[] = validSuppliers.map(
    (supplier, index) => ({
      countryCode: supplier.countryCode,
      country: supplier.country,
      importValue: supplier.importValue,
      share: total
        ? Number(((supplier.importValue / total) * 100).toFixed(2))
        : 0,
      rank: index + 1,
    }),
  );

  const originCode = input.originCode ?? null;
  const originRecord =
    originCode === null
      ? null
      : suppliers.find((supplier) => supplier.countryCode === originCode) ??
        null;

  const limitations: string[] = [];

  if (total === null) {
    limitations.push(
      "World import value is unavailable, so supplier shares cannot be established.",
    );
  }

  if (suppliers.length === 0) {
    limitations.push(
      "No valid supplier-country records were available.",
    );
  }

  const representedShare =
    total !== null
      ? Number(((representedValue / total) * 100).toFixed(2))
      : null;

  if (representedShare !== null && representedShare < 95) {
    limitations.push(
      "Supplier records do not cover the full destination import value.",
    );
  }

  let status: SupplierLandscapeStatus = "supported";

  if (suppliers.length === 0) {
    status = "unavailable";
  } else if (total === null || (representedShare !== null && representedShare < 95)) {
    status = "partial";
  }

  return {
    status,
    destinationCode: input.destinationCode,
    hsCode: input.hsCode,
    year: input.year,
    totalImportValue: total,
    suppliers,
    origin: {
      status:
        originCode === null
          ? "not_checked"
          : originRecord
            ? "recorded"
            : "no_record",
      countryCode: originCode,
      importValue: originRecord?.importValue ?? null,
      share: originRecord?.share ?? null,
      rank: originRecord?.rank ?? null,
    },
    coverage: {
      supplierCount: suppliers.length,
      representedValue,
      representedShare,
    },
    limitations,
  };
}
