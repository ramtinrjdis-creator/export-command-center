export type DataTruth = "reported" | "estimated" | "not-reported" | "mixed" | "unknown";
export type CoverageBand = "complete" | "partial" | "limited" | "unknown";
export type DataTrust = {
  source: string;
  period: number;
  retrievedAt: string;
  retrievalLabel: string;
  truth: DataTruth;
  coverage: CoverageBand;
  limitations: string[];
};
export type DataTrustInput = {
  source: string;
  period: number;
  retrievedAt: string;
  isReported?: boolean | null;
  isEstimated?: boolean;
  isQuantityEstimated?: boolean;
  originRequested?: boolean;
  originStatus?: string | null;
};
function retrievalLabel(value: string) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "Retrieval time unknown";
  const minutes = Math.max(0, (Date.now() - t) / 60000);
  if (minutes < 5) return "Retrieved just now";
  if (minutes < 60) return `Retrieved ${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `Retrieved ${Math.round(hours)} hr ago`;
  return `Retrieved ${Math.round(hours / 24)} d ago`;
}
export function buildDataTrust(input: DataTrustInput): DataTrust {
  const flagged = Boolean(input.isEstimated || input.isQuantityEstimated);
  const truth: DataTruth =
    input.isReported === true && !flagged ? "reported" :
    input.isReported === false && flagged ? "estimated" :
    input.isReported === false ? "not-reported" :
    input.isReported === true && flagged ? "mixed" : "unknown";
  const coverage: CoverageBand =
    !input.originRequested
      ? "partial"
      : input.originStatus === "recorded"
        ? "complete"
        : input.originStatus === "no_record"
          ? "partial"
          : "limited";
  const limitations = [
    `${input.source} market values describe destination-side imports for the requested period.`,
    ...(flagged ? ["At least one source field carries an estimation signal; it is not presented as fully reported data."] : []),
    ...(input.originRequested && input.originStatus !== "recorded" ? ["Origin-specific evidence is not established; missing evidence is not treated as zero trade."] : []),
    "Buyer identity, market access and competitive positioning are separate validation layers.",
  ];
  return { source: input.source, period: input.period, retrievedAt: input.retrievedAt, retrievalLabel: retrievalLabel(input.retrievedAt), truth, coverage, limitations };
}
