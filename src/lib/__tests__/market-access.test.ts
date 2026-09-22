import { describe, expect, it } from "vitest";
import { buildMarketAccess } from "../market-access";
describe("market access", () => { it("makes no unsupported claims without a provider", () => { const r = buildMarketAccess({marketName:"Germany",providerConfigured:false}); expect(r.status).toBe("not-connected"); expect(r.coverage).toContain("No tariff"); }); });
