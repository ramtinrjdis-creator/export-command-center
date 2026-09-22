import { describe, expect, it } from "vitest";
import {
  buildCompetitionContext,
  buildMarketAccessContext,
} from "../context/market-context";

describe("market context", () => {
  it("does not treat missing competition data as zero competition", () => {
    const result = buildCompetitionContext({
      originStatus: "no_record",
      originShare: null,
    });

    expect(result.status).toBe("unavailable");
    expect(result.supplierCount).toBeNull();
    expect(result.concentration).toBe("unknown");
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("preserves recorded origin evidence separately from competitive position", () => {
    const result = buildCompetitionContext({
      originStatus: "recorded",
      originShare: 2.4,
    });

    expect(result.originPosition).toBe("emerging");
    expect(result.concentration).toBe("unknown");
  });

  it("starts market access as unverified rather than assuming zero barriers", () => {
    const result = buildMarketAccessContext();

    expect(result.status).toBe("not-checked");
    expect(result.tariff.rate).toBeNull();
    expect(result.tariff.status).toBe("not-checked");
    expect(result.tradeRemedy).toBe("not-checked");
    expect(result.nonTariffMeasures).toBe("not-checked");
    expect(result.limitations.length).toBe(4);
  });
});
