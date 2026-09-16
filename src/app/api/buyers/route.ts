import { NextRequest, NextResponse } from "next/server";
import { getBuyerProvider } from "@/lib/buyers";
import { analyzeBuyer } from "@/lib/buyers/intelligence";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const hsCode = searchParams.get("hsCode")?.trim() ?? "";
  const market = Number(searchParams.get("market"));
  const limit = Number(searchParams.get("limit") ?? "20");

  if (!/^\d{2,6}$/.test(hsCode)) {
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

  const buyers = await provider.searchBuyers({
    hsCode,
    marketCountryCode: market,
    limit: safeLimit,
  });

  const analyzedBuyers = buyers.map((buyer) => ({
    ...buyer,
    intelligence: analyzeBuyer(buyer),
  }));

  return NextResponse.json({
    available: analyzedBuyers.length > 0,
    provider: provider.name,
    hsCode,
    marketCountryCode: market,
    buyers: analyzedBuyers,
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
    },
    limitations:
      analyzedBuyers.length === 0
        ? ["No live buyer provider is connected."]
        : [],
  });
}
