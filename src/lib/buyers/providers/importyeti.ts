import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
  BuyerRecord,
} from "../types";
import { normalizeBuyer } from "../normalize";

const BASE_URL =
  "https://data.importyeti.com/v1.0/product";

const IMPORTYETI_TIMEOUT_MS = 10_000;

type ImportYetiProductCompany = {
  company_link?: string;
  company_name?: string;
  matching_shipments?: number;
  specialization?: number;
  company_total_shipments?: number;
  company_experience?: number;
  product_description?: string | string[];
  company_suppliers?: string[] | number;
  total_suppliers?: number;
  weight?: number;
  relevance_score?: number;
};

type ImportYetiResponse = {
  requestCost?: number;
  creditsRemaining?: number;
  data?: ImportYetiProductCompany[] | {
    data?: ImportYetiProductCompany[];
    totalCompanies?: number;
  };
};

function getImportYetiRows(value: unknown): ImportYetiProductCompany[] {
  if (typeof value !== "object" || value === null) return [];

  const payload = value as Record<string, unknown>;
  const data = payload.data;

  if (Array.isArray(data)) {
    return data as ImportYetiProductCompany[];
  }

  if (typeof data === "object" && data !== null) {
    const nested = (data as Record<string, unknown>).data;
    return Array.isArray(nested)
      ? (nested as ImportYetiProductCompany[])
      : [];
  }

  return [];
}

function importYetiCompanyUrl(value: string | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;

  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  if (clean.startsWith("/")) {
    return "https://www.importyeti.com" + clean;
  }

  return "https://www.importyeti.com/" + clean;
}

function productMatchText(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length ? items.join(", ") : null;
  }

  const clean = value?.trim();
  return clean || null;
}

function normalizeCompanyId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `importyeti-${slug || "buyer"}-${index}`;
}

export class ImportYetiBuyerProvider implements BuyerDataProvider {
  name = "importyeti";

  async searchBuyers(
    input: BuyerSearchInput
  ): Promise<BuyerProviderResult> {
    const apiKey = process.env.IMPORTYETI_API_KEY;

    if (!apiKey) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "missing_credentials",
        meta: {
          provider: this.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    if (input.marketCountryCode !== 840) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "unsupported_market",
        meta: {
          provider: this.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const productDescription = input.productDescription?.trim();

    if (!productDescription) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "missing_product_query",
        meta: {
          provider: this.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

    const encodedProduct = encodeURIComponent(productDescription);

    const params = new URLSearchParams({
      page_size: String(limit),
    });

    try {
      const response = await fetch(
        `${BASE_URL}/${encodedProduct}/companies?${params.toString()}`,
        {
          headers: {
            IYApiKey: apiKey,
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(IMPORTYETI_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        return {
          status: "unavailable",
          buyers: [],
          reason:
            response.status === 403
              ? "insufficient_credits"
              : response.status === 429
                ? "rate_limited"
                : "provider_error",
          meta: {
            provider: this.name,
            requestCost: null,
            creditsRemaining: null,
            requestId: response.headers.get("x-request-id"),
            fetchedAt: new Date().toISOString(),
          },
        };
      }

      const rawPayload: unknown = await response.json();

      const payload = rawPayload as ImportYetiResponse;
      const rows = getImportYetiRows(payload);

      const buyers: BuyerRecord[] = rows
        .map((row, index) => {
          const companyName = row.company_name?.trim();

          if (!companyName) {
            return null;
          }

          const matchingShipments =
            typeof row.matching_shipments === "number"
              ? Math.max(0, Math.round(row.matching_shipments))
              : null;

          const totalShipments =
            typeof row.company_total_shipments === "number" &&
            Number.isFinite(row.company_total_shipments)
              ? Math.max(0, Math.round(row.company_total_shipments))
              : null;

          const relevance =
            typeof row.relevance_score === "number"
              ? row.relevance_score
              : null;

          const specialization =
            typeof row.specialization === "number"
              ? row.specialization
              : null;

          const strongEvidence =
            (matchingShipments !== null && matchingShipments >= 10) ||
            (relevance !== null && relevance >= 70) ||
            (specialization !== null && specialization >= 70);

          const moderateEvidence =
            (matchingShipments !== null && matchingShipments >= 3) ||
            (relevance !== null && relevance >= 40) ||
            (specialization !== null && specialization >= 40);

          return normalizeBuyer(
            {
              id: normalizeCompanyId(companyName, index),
              companyName,
              companyLink: importYetiCompanyUrl(row.company_link),
              countryCode: 840,
              country: "United States",
              shipmentCount: totalShipments,
              matchingShipments,
              lastShipmentDate: null,
              productMatch:
                productMatchText(row.product_description) ||
                productDescription,
              supplierCount:
                typeof row.total_suppliers === "number"
                  ? Math.max(0, Math.round(row.total_suppliers))
                  : typeof row.company_suppliers === "number"
                    ? Math.max(0, Math.round(row.company_suppliers))
                    : Array.isArray(row.company_suppliers)
                      ? row.company_suppliers.length
                      : null,
              source: "ImportYeti",
              evidenceStatus: strongEvidence
                ? "strong"
                : moderateEvidence
                  ? "moderate"
                  : "limited",
            },
            this.name
          );
        })
        .filter((buyer): buyer is BuyerRecord => buyer !== null);

      return {
        status: "available",
        buyers,
        meta: {
          provider: this.name,
          requestCost:
            typeof payload.requestCost === "number"
              ? payload.requestCost
              : null,
          creditsRemaining:
            typeof payload.creditsRemaining === "number"
              ? payload.creditsRemaining
              : null,
          requestId: response.headers.get("x-request-id"),
          fetchedAt: new Date().toISOString(),
          endpoint: `${BASE_URL}/{product}/companies`,
        },
      };
    } catch {
      return {
        status: "unavailable",
        buyers: [],
        reason: "provider_error",
        meta: {
          provider: this.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt: new Date().toISOString(),
        },
      };
    }
  }
}
