# Export Command Center

Evidence-driven export intelligence for market discovery and commercial validation.

## Product contract

Export Command Center separates six evidence layers:

1. Destination demand
2. Growth and historical momentum
3. Origin-specific trade evidence
4. Supplier-side competitive evidence
5. Buyer/company evidence
6. Market-access verification

A market signal is not proof of a sale. Missing evidence is never silently converted into zero trade.

## Current stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Vitest
- UN Comtrade Preview API for trade evidence
- World Bank WDI for supplemental macro context
- Optional paid buyer provider behind an explicit feature flag
- Browser-local saved research/monitoring in the zero-cost build

## Data integrity rules

### Destination vs origin

Destination imports answer whether a market buys the product. Origin-specific bilateral evidence is handled separately. A missing bilateral record is an evidence gap, not proof of zero exports.

### Estimation

Comtrade physical quantity/weight estimation flags are kept separate from the reported trade-value signal. A quantity estimate does not automatically mean the trade value itself was estimated.

### Competition

Supplier-country competition is requested on demand through `/api/suppliers`. The main scan does not fetch a supplier landscape for every candidate, which avoids multiplying upstream traffic and rate-limit exposure.

### Buyers

Free mode does not invent company names. Paid buyer research is only enabled explicitly and provider data remains subject to verification, recency and provider terms.

### Market access

Tariffs, taxes, regulations, rules of origin and non-tariff measures are not fabricated. The current build exposes the verification boundary until a compliant provider is connected.

## APIs

### `GET /api/analyze`

Parameters:

- `hsCode` — 2–6 digit HS code
- `year` — trade year
- `origin` — optional UN Comtrade reporter/partner country code

Returns evidence-backed market candidates with demand, growth, origin status, opportunity score, evidence score, decision profile, trust metadata and commercial-readiness blockers.

### `GET /api/suppliers`

Parameters:

- `hsCode`
- `market` — destination country code
- `marketName` — optional UI label
- `origin` — optional origin country code
- `year`
- `limit` — optional, capped at 25

Returns the selected destination's supplier-country competitive landscape on demand, including supplier rank/share and the selected origin's relative position when the record exists.

### `GET /api/buyers`

Parameters:

- `hsCode`
- `market`
- `marketName` — optional
- `productDescription` — optional
- `limit` — optional

Without the paid-provider feature flag, this returns free research queries rather than fabricated buyer records.

## Development gate

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Do not stage backup bundles, zip files, generated repair directories or ad-hoc scripts.

## Commercialization gate

Before paid rollout, perform a provider licensing review covering automated retrieval, caching, redistribution and commercial use. Provider economics and legal terms are part of the product architecture.
