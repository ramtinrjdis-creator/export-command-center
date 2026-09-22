export type BuyerResearchLink = {
  label: string;
  url: string;
};

export type BuyerResearch = {
  mode: "free-research";
  market: string;
  queries: string[];
  links: BuyerResearchLink[];
  note: string;
};

const MARKET_NAMES: Record<number, string> = {
  36: "Australia",
  40: "Austria",
  56: "Belgium",
  76: "Brazil",
  124: "Canada",
  156: "China",
  276: "Germany",
  356: "India",
  364: "Iran",
  380: "Italy",
  392: "Japan",
  528: "Netherlands",
  554: "New Zealand",
  578: "Norway",
  616: "Poland",
  620: "Portugal",
  682: "Saudi Arabia",
  702: "Singapore",
  710: "South Africa",
  724: "Spain",
  752: "Sweden",
  756: "Switzerland",
  764: "Thailand",
  792: "Türkiye",
  784: "United Arab Emirates",
  826: "United Kingdom",
  840: "United States",
};

const PRODUCT_NAMES: Record<string, string> = {
  "0901": "Coffee",
  "090111": "Coffee",
  "0801": "Coconuts",
  "0802": "Nuts",
  "0803": "Bananas",
  "0804": "Dates",
  "0806": "Grapes",
  "0813": "Dried fruit",
  "0902": "Tea",
  "0904": "Spices",
  "0910": "Spices",
  "1001": "Wheat",
  "1005": "Maize",
  "1201": "Soybeans",
  "1507": "Soybean oil",
  "1801": "Cocoa beans",
  "1806": "Chocolate",
  "2401": "Tobacco",
  "2603": "Copper ores",
  "2709": "Crude petroleum",
  "7403": "Refined copper",
  "7601": "Aluminium",
};

function searchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function resolveMarketName(marketCode: number, suppliedName?: string) {
  const cleanName = suppliedName?.trim();

  if (cleanName && cleanName.toLowerCase() !== "target market") {
    return cleanName;
  }

  return MARKET_NAMES[marketCode] ?? `country code ${marketCode}`;
}

export function resolveProductName(hsCode: string, suppliedProduct?: string) {
  const cleanProduct = suppliedProduct?.trim();

  if (cleanProduct && cleanProduct.toLowerCase() !== "product") {
    return cleanProduct;
  }

  const normalizedHs = hsCode.trim();

  return (
    PRODUCT_NAMES[normalizedHs] ??
    PRODUCT_NAMES[normalizedHs.slice(0, 4)] ??
    `HS ${normalizedHs}`
  );
}

export function buildBuyerResearch(input: {
  product: string;
  hsCode: string;
  market: string;
  marketCode?: number;
}): BuyerResearch {
  const hsCode = input.hsCode.trim();

  const product = resolveProductName(hsCode, input.product);

  const market =
    input.marketCode != null
      ? resolveMarketName(input.marketCode, input.market)
      : resolveMarketName(
          Number.NaN,
          input.market,
        );

  const queries = [
    `"${product}" importer buyer "${market}" ${hsCode}`,
    `"${product}" distributor wholesaler "${market}" ${hsCode}`,
    `site:linkedin.com/company "${product}" importer "${market}"`,
  ];

  return {
    mode: "free-research",
    market,
    queries,
    links: [
      { label: "Search importers / buyers", url: searchUrl(queries[0]) },
      { label: "Search distributors / wholesalers", url: searchUrl(queries[1]) },
      { label: "Search LinkedIn companies", url: searchUrl(queries[2]) },
    ],
    note:
      "Free mode does not invent company names. Verify each company against a primary website, trade record, or other reliable source before outreach.",
  };
}
