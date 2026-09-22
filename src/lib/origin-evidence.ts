export type OriginTradeRow = {
  countryCode?: number | string | null;
  importValue?: number | string | null;
};

export type OriginLookupStatus =
  | "available"
  | "unavailable"
  | "not-requested";

export type OriginEvidence = {
  status: "recorded" | "no_record" | "unavailable" | "not-requested";
  value: number | null;
  share: number | null;
  source: string | null;
  note: string;
};

export function mapOriginRowsToValues(
  rows: OriginTradeRow[],
): Map<number, number> {
  const values = new Map<number, number>();

  for (const row of rows) {
    const countryCode = Number(row?.countryCode);
    const importValue = Number(row?.importValue ?? 0);

    if (
      Number.isInteger(countryCode) &&
      countryCode > 0 &&
      Number.isFinite(importValue) &&
      importValue > 0
    ) {
      values.set(countryCode, importValue);
    }
  }

  return values;
}

export function buildOriginEvidence(
  status: OriginEvidence["status"],
  value: number | null,
  marketImportValue: number,
): OriginEvidence {
  const share =
    value !== null && marketImportValue > 0
      ? Number(((value / marketImportValue) * 100).toFixed(2))
      : null;

  return {
    status,
    value,
    share,
    source:
      status === "not-requested"
        ? null
        : "UN Comtrade",
    note:
      status === "recorded"
        ? "Recorded destination imports from the selected origin are available."
        : status === "no_record"
          ? "No bilateral record was returned for this screened market; this is not interpreted as zero trade."
          : status === "unavailable"
            ? "Origin-specific evidence could not be retrieved from the source."
            : "No origin-specific trade query was requested.",
  };
}
