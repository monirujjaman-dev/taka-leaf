import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const meta = (attr: "property" | "name", key: string) =>
  new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, "\\$&")}" content="([^"]+)"`).exec(html)?.[1];

describe("link preview (Open Graph)", () => {
  it("has the tags Facebook, LinkedIn, WhatsApp, Discord and Slack read", () => {
    for (const key of ["og:type", "og:site_name", "og:url", "og:title", "og:description", "og:image", "og:image:width", "og:image:height", "og:image:alt"]) {
      expect(meta("property", key), key).toBeTruthy();
    }
    expect(meta("property", "og:image")).toBe("%SITE_URL%/og-image.png?v=1");
  });

  it("has a large card for X", () => {
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
    expect(meta("name", "twitter:image")).toBe(meta("property", "og:image"));
  });

  it("ships a 1200×630 PNG under 300 KB (WhatsApp skips bigger images)", () => {
    const png = readFileSync(resolve(root, "public/og-image.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeLessThan(300 * 1024);
  });
});
