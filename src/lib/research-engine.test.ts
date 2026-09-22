import { describe, expect, it } from "vitest";
import { buildNextBestResearch } from "./research-engine";

describe("buildNextBestResearch", () => {
  it("puts origin validation first when origin is not recorded", () => {
    const tasks = buildNextBestResearch({
      importValue: 5_000_000_000,
      yoyGrowth: 31.2,
      demandScore: 98,
      score: 82,
      originExportStatus: "no_record",
      isQuantityEstimated: true,
      intelligence: {
        evidenceScore: 69,
      },
    });

    expect(tasks[0]?.id).toBe("validate-origin");
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("reacts to negative growth with a demand-decline task", () => {
    const tasks = buildNextBestResearch({
      importValue: 900_000_000,
      yoyGrowth: -14.5,
      demandScore: 78,
      score: 70,
      originExportStatus: "recorded",
      intelligence: {
        evidenceScore: 81,
      },
    });

    expect(
      tasks.some((task) => task.id === "investigate-decline")
    ).toBe(true);
  });

  it("adds evidence validation when evidence is weak", () => {
    const tasks = buildNextBestResearch({
      importValue: 1_000_000_000,
      yoyGrowth: 8,
      demandScore: 71,
      score: 66,
      originExportStatus: "recorded",
      intelligence: {
        evidenceScore: 42,
      },
    });

    expect(
      tasks.some((task) => task.id === "strengthen-evidence")
    ).toBe(true);
  });

  it("does not push buyer research ahead of unresolved origin evidence", () => {
    const tasks = buildNextBestResearch({
      importValue: 2_000_000_000,
      yoyGrowth: 10,
      demandScore: 95,
      score: 90,
      originExportStatus: "no_record",
      intelligence: {
        evidenceScore: 88,
      },
    });

    expect(tasks[0]?.id).toBe("validate-origin");
    expect(
      tasks.some((task) => task.id === "validate-buyers")
    ).toBe(false);
  });

  it("opens the commercial validation path after origin and evidence are resolved", () => {
    const tasks = buildNextBestResearch({
      importValue: 2_000_000_000,
      yoyGrowth: 10,
      demandScore: 85,
      score: 80,
      opportunity: { score: 84 },
      originExportStatus: "recorded",
      intelligence: {
        evidenceScore: 88,
      },
    });

    expect(
      tasks.some((task) => task.id === "validate-buyers")
    ).toBe(true);
    expect(
      tasks.some((task) => task.id === "validate-market-access")
    ).toBe(true);
  });

  it("returns a compact prioritized queue rather than a giant checklist", () => {
    const tasks = buildNextBestResearch({
      importValue: 2_000_000_000,
      yoyGrowth: 24,
      demandScore: 90,
      score: 84,
      originExportStatus: "no_record",
      isQuantityEstimated: true,
      intelligence: {
        evidenceScore: 55,
      },
    });

    expect(tasks.length).toBeLessThanOrEqual(4);
    expect(tasks.every((task) => task.action.length > 20)).toBe(true);
  });
});
