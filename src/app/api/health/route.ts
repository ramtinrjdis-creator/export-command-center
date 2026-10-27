import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buyerProviderConfigured() {
  const provider =
    process.env.BUYER_PROVIDER ??
    (process.env.IMPORTYETI_API_KEY
      ? "importyeti"
      : process.env.VOLZA_API_KEY
        ? "volza"
        : null);

  return {
    configured: Boolean(provider),
    provider: provider ?? "free-research",
    paidEnabled:
      process.env.ENABLE_PAID_BUYER_PROVIDER ===
      "true",
  };
}

export async function GET() {
  const buyers = buyerProviderConfigured();

  const response = NextResponse.json({
    ok: true,
    service: "export-command-center",
    status: "healthy",
    version: "smart-v8",
    timestamp: new Date().toISOString(),
    capabilities: {
      marketScan: true,
      supplierLandscape: true,
      buyerResearch: true,
      marketAccessEvidence: false,
      macroContext: true,
    },
    providers: {
      tradeData: {
        name: "UN Comtrade Preview API",
        configured: true,
      },
      macro: {
        name: "World Bank WDI",
        configured: true,
      },
      buyers,
      marketAccess: {
        configured: false,
        provider: "not-connected",
      },
    },
  });

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  return response;
}
