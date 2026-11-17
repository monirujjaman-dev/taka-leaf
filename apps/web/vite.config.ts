/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Where the site lives. Link previews (Open Graph) need absolute addresses; set SITE_URL to build for another domain. */
export const SITE_URL = (process.env.SITE_URL ?? "https://takaleaf.monirujjaman.dev").replace(/\/+$/, "");

/** Fills %SITE_URL% in index.html. */
function siteUrl(): Plugin {
  return { name: "takaleaf-site-url", transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL) };
}

// The backend runs on http://localhost:5080 in development; /api is proxied to it.
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl()],
  build: {
    rolldownOptions: {
      output: {
        /*
         * Pages are loaded on demand (app/routes.ts). Without these groups the bundler cuts the shared
         * code into a dozen tiny files, and on a phone each costs a round trip, queued with the
         * session request. So: one "core" chunk with everything the shell needs, one "pages" chunk
         * with the parts several pages share, and one chunk per page.
         */
        codeSplitting: {
          groups: [
            {
              name: "core",
              priority: 2,
              test: (id) =>
                /node_modules|[\\/]packages[\\/]shared[\\/]/.test(id) ||
                /[\\/]apps[\\/]web[\\/]src[\\/](ui|layout|api|shared|app)[\\/]/.test(id) ||
                /[\\/]src[\\/]auth[\\/]AuthContext/.test(id),
            },
            { name: "pages", priority: 1, test: /[\\/]src[\\/](pages|auth)[\\/]/, minShareCount: 2 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:5080", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
