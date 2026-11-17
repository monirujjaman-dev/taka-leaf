import { describe, expect, it } from "vitest";
import { balanceAfter, emiFor, formatRate, interestOfFirst, monthlyInterest, parseRate, schedule } from "./loan";

describe("loan arithmetic", () => {
  it("works out a reducing-balance EMI as banks do", () => {
    // ৳12,00,000 at 9.5 % for 60 months
    expect(emiFor(120_000_000, 950, 60)).toBe(2_520_223);
    expect(emiFor(90_000_000, 1025, 48)).toBe(2_293_453);
  });

  it("divides a 0 % card EMI evenly", () => {
    expect(emiFor(11_940_000, 0, 12)).toBe(995_000);
  });

  it("charges each month's interest on what is left, rounded half up", () => {
    expect(monthlyInterest(120_000_000, 950)).toBe(950_000);
    expect(monthlyInterest(89_751_312, 950)).toBe(710_531);
    expect(monthlyInterest(5, 1200)).toBe(0);
    expect(monthlyInterest(1_000_000_000_000, 10_000)).toBe(83_333_333_333);
  });

  it("repays the loan exactly, the last EMI taking what is left", () => {
    const rows = schedule(120_000_000, 950, 2_520_223);
    expect(rows).toHaveLength(60);
    expect(rows.at(-1)!.balanceAfter).toBe(0);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(120_000_000);
    expect(rows[18]).toMatchObject({ number: 19, principal: 1_809_692, interest: 710_531 });
  });

  it("knows what is left after the EMIs paid before TakaLeaf", () => {
    expect(balanceAfter(120_000_000, 950, 2_520_223, 18)).toBe(89_751_312);
    expect(interestOfFirst(120_000_000, 950, 2_520_223, 18)).toBe(15_115_326);
  });

  it("stops when the EMI never covers the interest", () => {
    expect(schedule(100_000_000, 1200, 1_000)).toEqual([]);
  });

  it("reads and shows rates", () => {
    expect(parseRate("9.5")).toBe(950);
    expect(parseRate("10.25 %")).toBe(1025);
    expect(parseRate("0")).toBe(0);
    expect(parseRate("101")).toBeNull();
    expect(parseRate("9.555")).toBeNull();
    expect([formatRate(950), formatRate(1025), formatRate(0), formatRate(1200)]).toEqual(["9.5%", "10.25%", "0%", "12%"]);
  });
});
