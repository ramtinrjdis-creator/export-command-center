import { NextRequest, NextResponse } from "next/server";
import { getBuyerProvider } from "@/lib/buyers";
import { buildBuyerSummary } from "@/lib/buyers/summary";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hsCode = searchParams.get("hsCode")?.trim() ?? "";
  const market = Number(searchParams.get("market"));
  const productDescription =
    searchParams.get("productDescription")?.trim() ?? "";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (!/^[0-9]{2,6}$/.test(hsCode)) {
    return NextResponse.json(
      { error: "hsCode must be 2-6 digits." },
      { status: 400 }
    );
  }

  if (!Number.isInteger(market) || market < 0) {
    return NextResponse.json(
      { error: "market must be a valid country code." },
      { status: 400 }
    );
  }

  const safeLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 20;

  const provider = getBuyerProvider();

  let result: Awaited<ReturnType<typeof provider.searchBuyers>>;

  try {
    result = await provider.searchBuyers({
      hsCode,
      marketCountryCode: market,
      productDescription: productDescription || undefined,
      limit: safeLimit,
    });
  } catch (error) {
    console.error("Buyer discovery error:", error);

    return NextResponse.json(
      {
        available: false,
        provider: provider.name,
        status: "unavailable",
        reason: "provider_error",
        hsCode,
        marketCountryCode: market,
        buyers: [],
        providerMeta: {
          provider: provider.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
        },
        summary: {
          total: 0,
          highSignal: 0,
          mediumSignal: 0,
          lowSignal: 0,
          verified: 0,
          partiallyVerified: 0,
          unverified: 0,
        },
        limitations: [
          "Buyer discovery is temporarily unavailable. Please try again.",
        ],
      },
      { status: 502 }
    );
  }

  if (result.status === "unavailable") {
    return NextResponse.json({
      available: false,
      provider: provider.name,
      status: result.status,
      reason: result.reason,
      hsCode,
      marketCountryCode: market,
      buyers: [],
      providerMeta: result.meta,
      summary: {
        total: 0,
        highSignal: 0,
        mediumSignal: 0,
        lowSignal: 0,
        verified: 0,
        partiallyVerified: 0,
        unverified: 0,
      },
      limitations: [
        result.reason === "missing_product_query"
          ? "A product description is required for the configured ImportYeti buyer search."
          : "No live buyer data is currently available.",
      ],
    });
  }

  const analyzedBuyers = result.buyers.map((buyer) =>
    buildBuyerSummary(buyer)
  );

  return NextResponse.json({
    available: true,
    provider: provider.name,
    status: result.status,
    hsCode,
    marketCountryCode: market,
    buyers: analyzedBuyers,
    providerMeta: result.meta,

    summary: {
      total: analyzedBuyers.length,

      highSignal: analyzedBuyers.filter(
        (buyer) => buyer.intelligence.signal === "high-signal"
      ).length,

      mediumSignal: analyzedBuyers.filter(
        (buyer) => buyer.intelligence.signal === "medium-signal"
      ).length,

      lowSignal: analyzedBuyers.filter(
        (buyer) => buyer.intelligence.signal === "low-signal"
      ).length,

      verified: analyzedBuyers.filter(
        (buyer) => buyer.verification.status === "verified"
      ).length,

      partiallyVerified: analyzedBuyers.filter(
        (buyer) =>
          buyer.verification.status === "partially-verified"
      ).length,

      unverified: analyzedBuyers.filter(
        (buyer) => buyer.verification.status === "unverified"
      ).length,
    },

    evidence: {
      strong: analyzedBuyers.filter(
        (buyer) => buyer.evidence.status === "strong"
      ).length,

      moderate: analyzedBuyers.filter(
        (buyer) => buyer.evidence.status === "moderate"
      ).length,

      limited: analyzedBuyers.filter(
        (buyer) => buyer.evidence.status === "limited"
      ).length,

      unavailable: analyzedBuyers.filter(
        (buyer) => buyer.evidence.status === "unavailable"
      ).length,
    },

    limitations:
      analyzedBuyers.length === 0
        ? ["Provider is connected but returned no buyers."]
        : [],
  });
}
