import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    "postgresql://enhanced_sw_user:enhanced_sw_password@localhost:5432/enhanced_sw"
  );
}

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL client error on idle client:", err);
    });
  }
  return pool;
}

/**
 * Set custom pool (useful for unit/integration testing mocks).
 */
export function setPool(customPool: pg.Pool | null): void {
  pool = customPool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
