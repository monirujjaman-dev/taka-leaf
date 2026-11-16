import type { Config } from "drizzle-kit";

// `pnpm --filter @takaleaf/mobile db:generate` writes a migration into drizzle/ after a schema change.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
} satisfies Config;
