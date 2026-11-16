import { describe, expect, it } from "vitest";
import fixtures from "../../../contract/fixtures/person-name.json";
import { checkName, initialOf } from "./name";

describe("checkName", () => {
  it.each(fixtures)("$input", ({ input, name, error }) => {
    const result = checkName(input);
    expect(result.error).toBe(error ?? null);
    if (!error) expect(result.name).toBe(name);
  });
});

describe("initialOf", () => {
  it("takes the first letter", () => {
    expect(initialOf("monir Hossain")).toBe("M");
    expect(initialOf("মনির")).toBe("ম");
    expect(initialOf("  ", "R")).toBe("R");
  });
});
