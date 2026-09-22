export type FreshnessBand =
  | "current"
  | "recent"
  | "stale"
  | "unknown";

export function getFreshnessBand(
  sourceYear: number | null | undefined,
  referenceYear = new Date().getUTCFullYear()
): FreshnessBand {
  if (
    sourceYear == null ||
    !Number.isFinite(sourceYear)
  ) {
    return "unknown";
  }

  const age = referenceYear - sourceYear;

  if (age <= 1) {
    return "current";
  }

  if (age <= 3) {
    return "recent";
  }

  return "stale";
}

export function freshnessLabel(
  band: FreshnessBand
) {
  switch (band) {
    case "current":
      return "Current";
    case "recent":
      return "Recent";
    case "stale":
      return "Stale";
    default:
      return "Unknown";
  }
}
