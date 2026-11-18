import { describe, expect, it } from "vitest";
import { dpsMaturity, drawCutoff, excise, nextDraw, percent, profit, taxOf, taxYearStart } from "./savings";

describe("savings maths", () => {
  it("works out FDR and certificate profit and tax as the server does", () => {
    expect(profit(50_000_000, 975, 12)).toBe(4_875_000);
    expect(taxOf(4_875_000, 1000)).toBe(487_500);
    expect(profit(50_000_000, 1104, 3)).toBe(1_380_000);
    expect(taxOf(1_380_000, 500)).toBe(69_000);
    expect(excise(300_000, 12)).toBe(300_000);
    expect(excise(300_000, 13)).toBe(600_000);
  });

  it("compounds a DPS monthly", () => {
    expect(dpsMaturity(500_000, 900, 60)).toBe(37_994_908);
    expect(dpsMaturity(500_000, 900, 59)).toBe(37_212_067);
    expect(dpsMaturity(500_000, 0, 12)).toBe(6_000_000);
  });

  it("finds the next prize bond draw and its 60-day cut-off", () => {
    expect(nextDraw("2026-11-18")).toBe("2027-01-31");
    expect(nextDraw("2026-10-31")).toBe("2026-10-31");
    expect(drawCutoff("2027-01-31")).toBe("2026-12-02");
  });

  it("knows the tax year and shows rates", () => {
    expect(taxYearStart("2026-11-18")).toBe("2026-07-01");
    expect(taxYearStart("2027-03-01")).toBe("2026-07-01");
    expect(percent(975)).toBe("9.75%");
    expect(percent(500)).toBe("5%");
  });
});
