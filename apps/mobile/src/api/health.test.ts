import { checkHealth, normaliseServerUrl } from "./health";

describe("server address", () => {
  it.each([
    ["takaleaf.example.com", "https://takaleaf.example.com"],
    ["  https://money.example.com/  ", "https://money.example.com"],
    ["http://192.168.0.5:5080", "http://192.168.0.5:5080"],
    ["https://example.com/takaleaf/", "https://example.com/takaleaf"],
  ])("%s → %s", (input, expected) => expect(normaliseServerUrl(input)).toBe(expected));

  it("refuses an empty or broken address", () => {
    expect(normaliseServerUrl("   ")).toBeNull();
    expect(normaliseServerUrl("http://")).toBeNull();
  });
});

describe("server check", () => {
  it("calls /api/health and reports success", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkHealth("https://t.example", 1000, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("https://t.example/api/health", expect.anything());
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/^Server answered in \d+ ms$/);
  });

  it("reports an error status", async () => {
    const result = await checkHealth("https://t.example", 1000, jest.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect(result).toEqual({ ok: false, detail: "Server answered 503" });
  });

  it("reports a network failure without throwing", async () => {
    const result = await checkHealth("https://t.example", 1000, jest.fn().mockRejectedValue(new TypeError("Network request failed")));
    expect(result).toEqual({ ok: false, detail: "Could not reach the server: Network request failed" });
  });

  it("gives up after the timeout", async () => {
    const hanging = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const result = await checkHealth("https://t.example", 20, hanging as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, detail: "No answer within 0 seconds" });
  });
});
