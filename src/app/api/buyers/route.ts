import { NextRequest, NextResponse } from "next/server";
import { evaluatePaidBuyerRouteGate } from "@/lib/commercial/v15-route-gate";
import { getBuyerProvider } from "@/lib/buyers";
import { buildBuyerExecution } from "@/lib/buyers/execution";
import { verifyEntitlementToken } from "@/lib/commercial/entitlement-token";
import { buildBuyerSummary } from "@/lib/buyers/summary";
import {
  buildBuyerResearch,
  resolveMarketName,
} from "@/lib/buyer-research";
import {
  buildBuyerProviderCacheKey,
  getCachedBuyerProviderResult,
} from "@/lib/buyers/provider-cache";

function isPaidProviderEnabled(request: NextRequest) {
  /*
   * V16.1 production containment.
   *
   * V15 environment flags are configuration claims, not proof of
   * authenticated identity, live subscription authority, durable
   * usage reservation, billing processing or abuse enforcement.
   *
   * Paid provider execution remains disabled in production until
   * V16 supplies and verifies the complete server-side authority.
   *
   * This must not be removed merely by enabling environment flags.
   */
  if (process.env.NODE_ENV === "production") {
    return false;
  }


  const v15PaidRouteGate =
    evaluatePaidBuyerRouteGate({
      paidProviderEnabled:
        process.env.ENABLE_PAID_BUYER_PROVIDER === "true",
    });

  if (!v15PaidRouteGate.allowed) {
    return false;
  }

  if (
    process.env.ECC_ALLOW_UNVERIFIED_PRO_PROVIDER === "true"
  ) {
    return true;
  }

  const token = request.headers.get("x-ecc-entitlement-token");
  const secret = process.env.ECC_ENTITLEMENT_SECRET;

  return verifyEntitlementToken(
    token,
    secret,
    "buyer_intelligence",
  ).valid;
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

  if (isPaidProviderEnabled(request)) {
    const safeLimit =
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, 25)
        : 10;
    const provider = getBuyerProvider();
    const cacheKey = buildBuyerProviderCacheKey({
      provider: provider.name,
      hsCode,
      marketCode,
      productDescription,
      limit: safeLimit,
    });
    let cacheHit = false;
    let result: Awaited<ReturnType<typeof provider.searchBuyers>>;

    try {
      const cached = await getCachedBuyerProviderResult(
        cacheKey,
        () => provider.searchBuyers({
          hsCode,
          marketCountryCode: marketCode,
          productDescription: productDescription || undefined,
          limit: safeLimit,
        }),
      );
      result = cached.value;
      cacheHit = cached.hit;
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
      const analyzedBuyers = result.buyers.map((buyer) => {
        const summary = buildBuyerSummary(buyer);

        return {
          ...buyer,
          company: buyer.companyName,
          name: buyer.companyName,
          country: buyer.country,
          matchedShipments: buyer.matchingShipments,
          intelligence: summary.intelligence,
          evidence: summary.evidence,
          verification: summary.verification,
          readiness: summary.readiness,
          commercial: buildBuyerExecution(buyer),
        };
      });

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
        providerUsage: {
          cache: cacheHit ? "hit" : "miss",
          requestCostCredits: result.meta.requestCost,
          creditsRemaining: result.meta.creditsRemaining,
          accounting: "provider-reported-credits",
        },
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
    providerUsage: {
      cache: "none",
      requestCostCredits: null,
      creditsRemaining: null,
      accounting: "not-applicable",
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
      "No paid company database is required in free mode.",
      "Company-level buyer records must be verified before outreach.",
    ],
  });
}
