import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
  BuyerRecord,
} from "../types";
import { normalizeBuyer } from "../normalize";

const BASE_URL =
  "https://data.importyeti.com/v1.0/product";

type ImportYetiProductCompany = {
  company_link?: string;
  company_name?: string;
  matching_shipments?: number;
  specialization?: number;
  company_total_shipments?: number;
  company_experience?: number;
  product_description?: string;
  company_suppliers?: number;
  total_suppliers?: number;
  weight?: number;
  relevance_score?: number;
};

type ImportYetiResponse = {
  requestCost?: number;
  creditsRemaining?: number;
  data?: {
    data?: ImportYetiProductCompany[];
    totalCompanies?: number;
  };
};

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
      };
    }

    if (input.marketCountryCode !== 840) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "unsupported_market",
      };
    }

    const productDescription = input.productDescription?.trim();

    if (!productDescription) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "missing_product_query",
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
        }
      );

      if (!response.ok) {
        return {
          status: "unavailable",
          buyers: [],
          reason: "provider_error",
        };
      }

      const payload =
        (await response.json()) as ImportYetiResponse;

      const rows = payload.data?.data ?? [];

      const buyers: BuyerRecord[] = rows
        .map((row, index) => {
          const companyName = row.company_name?.trim();

          if (!companyName) {
            return null;
          }

          const matchingShipments =
            typeof row.matching_shipments === "number"
              ? row.matching_shipments
              : 0;

          const totalShipments =
            typeof row.company_total_shipments === "number"
              ? row.company_total_shipments
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
            matchingShipments >= 10 ||
            (relevance !== null && relevance >= 70) ||
            (specialization !== null && specialization >= 70);

          const moderateEvidence =
            matchingShipments >= 3 ||
            (relevance !== null && relevance >= 40) ||
            (specialization !== null && specialization >= 40);

          return normalizeBuyer(
            {
              id: normalizeCompanyId(companyName, index),
              companyName,
              companyLink: row.company_link?.trim() || null,
              countryCode: 840,
              country: "United States",
              shipmentCount: totalShipments,
              matchingShipments,
              lastShipmentDate: null,
              productMatch:
                row.product_description?.trim() ||
                productDescription,
              source: "importyeti",
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
      };
    } catch {
      return {
        status: "unavailable",
        buyers: [],
        reason: "provider_error",
      };
    }
  }
}
