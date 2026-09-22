import { describe, expect, it } from "vitest";
import { buildCommercialReadiness } from "../commercial-readiness";
describe("commercial readiness", () => { it("stops at buyer validation when buyers are absent", () => { const r = buildCommercialReadiness({evidenceScore:82,originStatus:"recorded",buyerEvidenceEstablished:false,marketAccessStatus:"not-connected"}); expect(r.stage).toBe("buyer-validation"); expect(r.blockers.join(" ")).toContain("buyer evidence"); }); });
