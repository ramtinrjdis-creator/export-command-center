export function calculateOriginShare(
  originExportValue: number | null,
  marketImportValue: number
): number | null {
  if (
    originExportValue === null ||
    !Number.isFinite(originExportValue) ||
    originExportValue <= 0 ||
    !Number.isFinite(marketImportValue) ||
    marketImportValue <= 0
  ) {
    return null;
  }

  const share = (originExportValue / marketImportValue) * 100;

  if (!Number.isFinite(share) || share <= 0) {
    return null;
  }

  return Number(share.toFixed(6));
}

export function formatOriginShare(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;

  if (value > 0 && value < 0.01) {
    return "<0.01%";
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}
