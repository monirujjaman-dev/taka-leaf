import { describe, expect, it } from "vitest";
import fixtures from "../../../contract/fixtures/money-format.json";
import { formatBdt, parseTaka } from "./money";

describe("formatBdt (shared fixture F-7)", () => {
  for (const { poisha, text } of fixtures) {
    it(`${poisha} poisha -> ${text}`, () => {
      expect(formatBdt(poisha)).toBe(text);
    });
  }

  it("refuses amounts that are not whole poisha", () => {
    expect(() => formatBdt(12.5)).toThrow(RangeError);
  });
});

describe("parseTaka", () => {
  it.each([
    ["1250", 125000],
    ["1,250.5", 125050],
    ["1250.50", 125050],
    ["0.05", 5],
    ["৳1,25,000", 12500000],
  ])("%s -> %i", (text, poisha) => {
    expect(parseTaka(text)).toBe(poisha);
  });

  it.each(["", "abc", "-5", "1.234", "1..2"])("refuses %j", (text) => {
    expect(parseTaka(text)).toBeNull();
  });
});
