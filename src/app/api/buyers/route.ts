import { NextRequest, NextResponse } from "next/server";
import { getBuyerProvider } from "@/lib/buyers";
import { buildBuyerSummary } from "@/lib/buyers/summary";
import {
  buildBuyerResearch,
  resolveMarketName,
} from "@/lib/buyer-research";

function isPaidProviderEnabled() {
  return process.env.ENABLE_PAID_BUYER_PROVIDER === "true";
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const hsCode = searchParams.get("hsCode")?.trim() ?? "";
  const marketCode = Number(searchParams.get("market"));
  const marketName = resolveMarketName(
    marketCode,
    searchParams.get("marketName")?.trim(),
  );
  const productDescription = searchParams.get("productDescription")?.trim() ?? "";
  const limit = Number(searchParams.get("limit") ?? "10");

  if (!/^\d{2,6}$/.test(hsCode)) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "hsCode must be 2-6 digits.",
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(marketCode) || marketCode < 1) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "market must be a valid country code.",
      },
      { status: 400 },
    );
  }

  let providerFallbackReason: string | null = null;

  if (isPaidProviderEnabled()) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const provider = getBuyerProvider();

    let result: Awaited<ReturnType<typeof provider.searchBuyers>>;

    try {
      result = await provider.searchBuyers({
        hsCode,
        marketCountryCode: marketCode,
        productDescription: productDescription || undefined,
        limit: safeLimit,
      });
    } catch (error) {
      console.error("Buyer provider error:", error);

      result = {
        status: "unavailable",
        buyers: [],
        reason: "provider_error",
        meta: {
          provider: provider.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
          dataUpdatedAt: null,
          endpoint: null,
        },
      };
    }

    if (result.status !== "unavailable") {
      const analyzedBuyers = result.buyers.map((buyer) => buildBuyerSummary(buyer));
      return NextResponse.json({
        ok: true,
        available: true,
        mode: "provider",
        provider: provider.name,
        status: result.status,
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        hsCode,
        marketCountryCode: marketCode,
        buyers: analyzedBuyers,
        providerMeta: result.meta,
      });
    }

    if (result.status === "unavailable") {
      providerFallbackReason = result.reason;
    }
  }

  const research = buildBuyerResearch({
    product: productDescription,
    hsCode,
    market: marketName,
    marketCode,
  });

  return NextResponse.json({
    ok: true,
    available: false,
    mode: "free-research",
    provider: "free-research",
    providerFallbackReason,
    requestId,
    durationMs: Math.round(performance.now() - startedAt),
    status: "research_mode",
    hsCode,
    marketCountryCode: marketCode,
    buyers: [],
    research,
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
      "No paid company database is required in free mode.",
      "Company-level buyer records must be verified before outreach.",
    ],
  });
}
