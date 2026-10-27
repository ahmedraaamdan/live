import { defineConfig } from "drizzle-kit";

// `generate` only diffs the schema against ./drizzle, so it needs no
// database; `push` and `studio` do. Paths are relative to this folder (the
// scripts run here); drizzle-kit can't glob absolute Windows paths.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
