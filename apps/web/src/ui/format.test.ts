import { describe, expect, it } from "vitest";
import { fromLocalInput, lastDayOf, localDate, localMonth, shiftMonth, signedAmount, toAmountText, toLocalInput } from "./format";

describe("dates in Bangladesh time (F-9)", () => {
  it("11:30 PM on 30 November is still November", () => {
    const moment = new Date("2026-11-30T17:30:00Z");
    expect(localDate(moment)).toBe("2026-11-30");
    expect(localMonth(moment)).toBe("2026-11");
    expect(localMonth(new Date("2026-11-30T18:00:00Z"))).toBe("2026-12");
  });

  it("reads and writes the datetime field as UTC+6", () => {
    expect(fromLocalInput("2026-11-30T23:30")).toBe("2026-11-30T17:30:00.000Z");
    expect(toLocalInput("2026-11-30T17:30:00Z")).toBe("2026-11-30T23:30");
  });

  it("moves between months and knows month lengths", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
  });
});

describe("amounts", () => {
  it("shows which way the money went", () => {
    expect(signedAmount({ type: "Income", amount: 8500000 })).toBe("+৳85,000.00");
    expect(signedAmount({ type: "Expense", amount: 125000 })).toBe("−৳1,250.00");
    expect(signedAmount({ type: "Transfer", amount: 500000 })).toBe("৳5,000.00");
  });

  it("puts poisha back into an amount field", () => {
    expect(toAmountText(125050)).toBe("1250.50");
    expect(toAmountText(500000)).toBe("5000");
    expect(toAmountText(null)).toBe("");
  });
});
