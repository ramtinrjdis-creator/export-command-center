import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
  BuyerRecord,
} from "../types";
import { normalizeBuyer } from "../normalize";

const BASE_URL =
  "https://data.importyeti.com/v1.0/powerquery/us-import/companies";

type ImportYetiCompany = {
  key?: string;
  doc_count?: number;
  total_shipments?: number;
  name_variations?: string[];
  company_country_code?: string;
  company_country?: string;
  company_link?: string;
  company_website?: Array<{ key?: string; doc_count?: number }>;
  company_main_phone_number?: string;
  company_contact_info?: {
    emails?: string[];
    phone_numbers?: string[];
  };
};

type ImportYetiResponse = {
  requestCost?: number;
  creditsRemaining?: number;
  data?: {
    data?: ImportYetiCompany[];
    totalCompanies?: number;
  };
};

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

    const params = new URLSearchParams({
      page_size: String(limit),
      product_description: productDescription,
    });

    try {
      const response = await fetch(
        `${BASE_URL}?${params.toString()}`,
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
          const companyName = row.key?.trim();

          if (!companyName) {
            return null;
          }

          const matchedShipments =
            typeof row.doc_count === "number"
              ? row.doc_count
              : 0;

          const totalShipments =
            typeof row.total_shipments === "number"
              ? row.total_shipments
              : null;

          return normalizeBuyer(
            {
              id: `importyeti-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
              companyName,
              countryCode: 840,
              country: row.company_country ?? "United States",
              shipmentCount:
                totalShipments ?? matchedShipments,
              lastShipmentDate: null,
              productMatch: productDescription,
              source: "importyeti",
              evidenceStatus:
                matchedShipments >= 10
                  ? "strong"
                  : matchedShipments >= 3
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
