import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool, getDatabaseUrl } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  console.log(`Running database migration on ${getDatabaseUrl()}...`);
  const pool = getPool();

  try {
    await pool.query(schemaSql);
    console.log("✓ Database migrations applied successfully.");
  } catch (err: unknown) {
    console.error("✗ Failed to apply database migrations:", err);
    throw err;
  } finally {
    await closePool();
  }
}

// Allow direct execution: tsx src/db/migrate.ts
if (process.argv[1] === __filename) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
