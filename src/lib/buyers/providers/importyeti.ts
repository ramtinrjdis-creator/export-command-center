import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
  BuyerRecord,
} from "../types";
import { normalizeBuyer } from "../normalize";

const BASE_URL =
  "https://data.importyeti.com/v1.0/powerquery/us-import/bols";

type ImportYetiBol = {
  bol_number?: string;
  arrival_date?: string;
  company_name?: string;
  company_total_shipments?: number;
  company_country?: string;
  company_country_code?: string;
  product_description?: string;
  hs_code?: string | null;
};

type ImportYetiResponse = {
  data?: {
    data?: ImportYetiBol[];
    totalCount?: number;
  };
  requestCost?: number;
  creditsRemaining?: number;
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

    // ImportYeti's US-import dataset is appropriate only
    // when the selected market is the United States.
    if (input.marketCountryCode !== 840) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "unsupported_market",
      };
    }

    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

    const params = new URLSearchParams({
      page_size: String(limit),
      hs_code: input.hsCode,
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

      const grouped = new Map<
        string,
        {
          companyName: string;
          shipmentCount: number;
          lastShipmentDate: string | null;
          country: string | null;
          productDescriptions: Set<string>;
          totalShipments: number | null;
        }
      >();

      for (const row of rows) {
        const companyName = row.company_name?.trim();

        if (!companyName) continue;

        const key = companyName.toLowerCase();
        const existing = grouped.get(key);

        if (!existing) {
          grouped.set(key, {
            companyName,
            shipmentCount: 1,
            lastShipmentDate: row.arrival_date ?? null,
            country: row.company_country ?? "United States",
            productDescriptions: new Set(
              row.product_description
                ? [row.product_description]
                : []
            ),
            totalShipments:
              typeof row.company_total_shipments === "number"
                ? row.company_total_shipments
                : null,
          });

          continue;
        }

        existing.shipmentCount += 1;

        if (
          row.arrival_date &&
          (!existing.lastShipmentDate ||
            row.arrival_date > existing.lastShipmentDate)
        ) {
          existing.lastShipmentDate = row.arrival_date;
        }

        if (row.product_description) {
          existing.productDescriptions.add(
            row.product_description
          );
        }

        if (
          typeof row.company_total_shipments === "number"
        ) {
          existing.totalShipments =
            row.company_total_shipments;
        }
      }

      const buyers: BuyerRecord[] = Array.from(
        grouped.entries()
      ).map(([key, value]) =>
        normalizeBuyer(
          {
            id: `importyeti-${key}`,
            companyName: value.companyName,
            countryCode: 840,
            country: value.country,
            shipmentCount:
              value.totalShipments ?? value.shipmentCount,
            lastShipmentDate: value.lastShipmentDate,
            productMatch:
              value.productDescriptions.size > 0
                ? Array.from(
                    value.productDescriptions
                  ).join(", ")
                : `HS ${input.hsCode}`,
            source: "importyeti",
            evidenceStatus:
              value.shipmentCount >= 3
                ? "strong"
                : value.shipmentCount >= 2
                  ? "moderate"
                  : "limited",
          },
          this.name
        )
      );

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
