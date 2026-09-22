import { describe, expect, it } from "vitest";
import { buildDataTrust } from "../trust-layer";
describe("data trust", () => { it("distinguishes estimated from reported", () => { const r = buildDataTrust({source:"UN Comtrade",period:2024,retrievedAt:new Date().toISOString(),isReported:false,isEstimated:true,isQuantityEstimated:true,originRequested:true,originStatus:"no_record"}); expect(r.truth).toBe("estimated"); expect(r.coverage).toBe("partial"); expect(r.limitations.join(" ")).toContain("not treated as zero"); }); });
