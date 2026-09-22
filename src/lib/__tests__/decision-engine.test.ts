import { describe, expect, it } from "vitest";
import { buildDecisionProfile } from "../decision-engine";

describe("decision engine", () => {
  it("separates priority from confidence", () => {
    const result = buildDecisionProfile({
      demandScore: 96,
      yoyGrowth: 25,
      isReported: true,
      isQuantityEstimated: false,
      originExportStatus: "recorded",
      intelligence: { evidenceScore: 85 },
    });

    expect(result.priority).toBeGreaterThan(80);
    expect(result.confidence).toBeGreaterThan(75);
    expect(result.unknowns).toContain(
      "Qualified buyer evidence is not established."
    );
  });

  it("surfaces counter-signals when evidence is weak", () => {
    const result = buildDecisionProfile({
      demandScore: 55,
      yoyGrowth: -8,
      isReported: false,
      isQuantityEstimated: true,
      originExportStatus: "no_record",
      intelligence: { evidenceScore: 45 },
    });

    expect(result.confidence).toBeLessThan(60);
    expect(result.counterSignals.length).toBeGreaterThan(0);
    expect(result.nextAction).toContain("Verify origin-specific");
  });
});


describe("decision engine v4", () => {
  it("treats missing origin as a validation gate", () => {
    const result = buildDecisionProfile({
      demandScore: 98,
      yoyGrowth: 31.2,
      isReported: false,
      isQuantityEstimated: true,
      originExportStatus: "no_record",
      intelligence: { evidenceScore: 69 },
    });

    expect(result.priorityLabel).toBe("Priority to validate");
    expect(result.decisionState).toBe("validate-origin");
    expect(result.researchPriority).toBe("HIGH");
    expect(result.invalidationTriggers.length).toBeGreaterThan(0);
  });

  it("allows an evidence-backed market to move toward buyers", () => {
    const result = buildDecisionProfile({
      demandScore: 88,
      yoyGrowth: 12,
      isReported: true,
      isQuantityEstimated: false,
      originExportStatus: "recorded",
      intelligence: { evidenceScore: 82 },
    });

    expect(result.priorityLabel).toBe("Actionable signal");
    expect(result.decisionState).toBe("validate-buyers");
    expect(result.confidenceLabel).toBe("High");
  });

  it("does not call unavailable origin evidence a zero", () => {
    const result = buildDecisionProfile({
      demandScore: 80,
      yoyGrowth: 8,
      originExportStatus: "unavailable",
      intelligence: { evidenceScore: 60 },
    });

    expect(result.decisionState).toBe("resolve-data-gap");
    expect(result.counterSignals.join(" ")).toContain("currently unavailable");
  });

  it("uses canonical market potential instead of rebuilding demand and growth", () => {
    const highPotential = buildDecisionProfile({
      demandScore: 20,
      yoyGrowth: -20,
      opportunity: { score: 92 },
      originExportStatus: "recorded",
      intelligence: { evidenceScore: 80 },
    });

    const lowPotential = buildDecisionProfile({
      demandScore: 99,
      yoyGrowth: 40,
      opportunity: { score: 42 },
      originExportStatus: "recorded",
      intelligence: { evidenceScore: 80 },
    });

    expect(highPotential.priority).toBeGreaterThan(
      lowPotential.priority
    );
  });

  it("treats data_unavailable origin as a real data gap", () => {
    const result = buildDecisionProfile({
      opportunity: { score: 90 },
      originExportStatus: "data_unavailable",
      intelligence: { evidenceScore: 80 },
    });

    expect(result.decisionState).toBe("resolve-data-gap");
    expect(result.priorityLabel).toBe("Data gap");
  });

});
