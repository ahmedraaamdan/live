import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Set by initDb() before the server starts listening. ES module bindings are
 * live, so every `import { db }` sees the connected instance.
 */
export let db: Db = undefined as unknown as Db;
export let pool: pg.Pool | undefined;

/**
 * Connects to Postgres at DATABASE_URL and applies pending migrations.
 *
 * Without DATABASE_URL (local development only) it falls back to PGlite, an
 * embedded Postgres stored in PGLITE_DIR, so the app runs with no database
 * to install. Both packages are imported lazily and kept out of the
 * production bundle (see the api-server's build.mjs).
 */
export async function initDb(opts: { migrationsFolder: string; pgliteDir?: string }): Promise<"postgres" | "pglite"> {
  const url = process.env.DATABASE_URL;
  if (url) {
    pool = new pg.Pool({ connectionString: url });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: opts.migrationsFolder });
    return "postgres";
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be set in production.");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
  const dir = opts.pgliteDir ?? path.resolve(".data/pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const local = drizzlePglite(client, { schema });
  await migratePglite(local, { migrationsFolder: opts.migrationsFolder });
  db = local as unknown as Db;
  return "pglite";
}

export * from "./schema";
