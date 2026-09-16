export type BuyerValidationResult = {
  provider: string;
  hsCode: string;
  marketCountryCode: number;
  searches: number;
  candidates: number;
  usableBuyers: number;
  verifiedBuyers: number;
  outreachReadyBuyers: number;
  limitations: string[];
};

export function createBuyerValidationResult(
  provider: string,
  hsCode: string,
  marketCountryCode: number
): BuyerValidationResult {
  return {
    provider,
    hsCode,
    marketCountryCode,
    searches: 0,
    candidates: 0,
    usableBuyers: 0,
    verifiedBuyers: 0,
    outreachReadyBuyers: 0,
    limitations: [],
  };
}
