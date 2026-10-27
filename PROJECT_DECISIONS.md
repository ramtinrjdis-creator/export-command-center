# Export Command Center — Project Decisions

## Product mission
Evidence-driven export intelligence.
Find where your product can actually win.

Real trade evidence → market decision → actionable sales research.

Missing data is not zero. Never fabricate evidence, buyers,
market demand, source freshness, confidence, or access rights.

## Commercial strategy
- Free Research must provide genuine research value.
- Pro Decision Pack adds deeper evidence and buyer intelligence.
- B2B/Enterprise remains a potential recurring-revenue channel.
- Validate demand, provider economics, licensing and data quality
  before spending on new features or infrastructure.
- Prioritize completing the commercial core over feature bloat.

## Current checkpoint
V16.8G-C
9d779a4d97779fe0295634d74388229de076e12c

Evidence at this checkpoint:
- 202 ordinary tests passed.
- Seven isolated real PostgreSQL integration tests passed.
- TypeScript, ESLint and production build passed.
- Production dependency audit reported zero vulnerabilities.
- Paid provider remains disabled in production.
- No operational billing, production PostgreSQL or provider
  deployment has been established by these tests.

## Financial architecture
Billing must be independent of any single payment provider.

Payment confirmation must be verified server-side before
Subscription Authority grants paid entitlements.

Maintain an auditable payment ledger and separate:
- Invoice creation
- Payment initiation
- Verified payment evidence
- Settlement and refunds
- Subscription entitlement
- Provider execution and usage accounting

## Founder operating constraints
The founder is operating from Iran.

International payment availability, eligibility, settlement,
withdrawal, identity verification and commercial restrictions
must be validated before choosing any service.

USDT is a possible future payment option, subject to applicable
law, provider support and operational risk assessment.

Do not assume any processor or crypto network is supported.
Do not bypass identity verification or service restrictions.
Never store wallet private keys or seed phrases in the project.

## Security invariants
- Never trust client-supplied plan or payment confirmation.
- Never treat a provider timeout as confirmed failure.
- No automatic paid-provider retry for an uncertain operation.
- Account-wide quotas must be transactionally serialized.
- A confirmed financial outcome and usage settlement must be
  recorded atomically.
- Legacy usage commit/release must not bypass provider settlement.
- Reconciliation needs a durable, auditable authorization path.
- Paid production stays disabled until prerequisites are verified.

## Next execution priorities
1. V16.8H: close legacy settlement bypasses.
2. Establish trusted provider outcome authority.
3. Auditable reconciliation without automatic paid retry.
4. Durable PostgreSQL abuse/rate controls.
5. Validate real Auth, subscription, billing and database wiring.
6. Assess licensing and legal payment/settlement options.
7. Controlled commercial pilot and end-to-end verification.

## Engineering workflow
Preserve checkpoints and existing backups.
Inspect before changing code.
Never use destructive reset, clean or force-push operations.
Stage only explicit intended files.
Run focused tests, full regression, lint, typecheck and build.
Verify local and remote SHA after each successful push.
Do not represent Mock tests as proof of live production readiness.
