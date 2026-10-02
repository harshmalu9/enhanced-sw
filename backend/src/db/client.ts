import pg from "pg";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;
let useMemoryFallback = false;

interface MemoryExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
  created_at: Date;
  updated_at: Date;
}

interface MemoryBudget {
  id: string;
  month_year: string;
  monthly_budget: number;
  category_budgets: Record<string, number> | string;
  created_at: Date;
  updated_at: Date;
}

const memoryStore = {
  expenses: new Map<string, MemoryExpense>(),
  budgets: new Map<string, MemoryBudget>(),
};

function executeInMemoryQuery<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): pg.QueryResult<T> {
  const normalized = text.trim().toLowerCase();

  // Transaction control
  if (normalized === "begin" || normalized === "commit" || normalized === "rollback") {
    return {
      rows: [],
      rowCount: 0,
      command: normalized.toUpperCase(),
      oid: 0,
      fields: [],
    };
  }

  // Expenses INSERT
  if (normalized.startsWith("insert into expenses")) {
    const id = randomUUID();
    const now = new Date();
    const description = params?.[0] ?? "";
    const amount = Number(params?.[1] ?? 0);
    const category = params?.[2] ?? "Other";
    const merchant = params?.[3] ?? null;
    const dateStr = params?.[4] || now.toISOString().split("T")[0];

    const record: MemoryExpense = {
      id,
      description,
      amount,
      category,
      merchant,
      expense_date: dateStr,
      created_at: now,
      updated_at: now,
    };
    memoryStore.expenses.set(id, record);

    return {
      rows: [record as unknown as T],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    };
  }

  // Expenses SELECT by ID
  if (normalized.startsWith("select") && normalized.includes("from expenses") && normalized.includes("where id =")) {
    const id = params?.[0];
    const record = memoryStore.expenses.get(id);
    const rows = record ? [record as unknown as T] : [];
    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Expenses SELECT ALL
  if (normalized.startsWith("select") && normalized.includes("from expenses")) {
    const rows = Array.from(memoryStore.expenses.values()).sort((a, b) => {
      const dateDiff = b.expense_date.localeCompare(a.expense_date);
      if (dateDiff !== 0) return dateDiff;
      return b.created_at.getTime() - a.created_at.getTime();
    }) as unknown as T[];

    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Expenses DELETE ALL
  if (normalized === "delete from expenses") {
    const count = memoryStore.expenses.size;
    memoryStore.expenses.clear();
    return {
      rows: [],
      rowCount: count,
      command: "DELETE",
      oid: 0,
      fields: [],
    };
  }

  // Expenses DELETE by ID
  if (normalized.startsWith("delete from expenses")) {
    const id = params?.[0];
    const existed = memoryStore.expenses.delete(id);
    return {
      rows: [],
      rowCount: existed ? 1 : 0,
      command: "DELETE",
      oid: 0,
      fields: [],
    };
  }

  // Budgets SELECT by month
  if (normalized.startsWith("select") && normalized.includes("from budgets") && normalized.includes("where month_year =")) {
    const monthYear = params?.[0];
    const record = memoryStore.budgets.get(monthYear);
    const rows = record ? [record as unknown as T] : [];
    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Budgets SELECT ALL
  if (normalized.startsWith("select") && normalized.includes("from budgets")) {
    const rows = Array.from(memoryStore.budgets.values()).sort((a, b) =>
      b.month_year.localeCompare(a.month_year)
    ) as unknown as T[];

    return {
      rows,
      rowCount: rows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Budgets INSERT / UPSERT
  if (normalized.startsWith("insert into budgets")) {
    const monthYear = params?.[0];
    const monthlyBudget = Number(params?.[1] ?? 0);
    const categoryBudgets = params?.[2] ?? "{}";
    const now = new Date();

    const existing = memoryStore.budgets.get(monthYear);
    const record: MemoryBudget = {
      id: existing ? existing.id : randomUUID(),
      month_year: monthYear,
      monthly_budget: monthlyBudget,
      category_budgets: categoryBudgets,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    memoryStore.budgets.set(monthYear, record);

    return {
      rows: [record as unknown as T],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    };
  }

  // Budgets DELETE ALL
  if (normalized === "delete from budgets") {
    const count = memoryStore.budgets.size;
    memoryStore.budgets.clear();
    return {
      rows: [],
      rowCount: count,
      command: "DELETE",
      oid: 0,
      fields: [],
    };
  }

  // Budgets DELETE by month
  if (normalized.startsWith("delete from budgets")) {
    const monthYear = params?.[0];
    const existed = memoryStore.budgets.delete(monthYear);
    return {
      rows: [],
      rowCount: existed ? 1 : 0,
      command: "DELETE",
      oid: 0,
      fields: [],
    };
  }

  return {
    rows: [],
    rowCount: 0,
    command: "UNKNOWN",
    oid: 0,
    fields: [],
  };
}

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    "postgresql://enhanced_sw_user:enhanced_sw_password@localhost:5432/enhanced_sw"
  );
}

export function getPool(): {
  query: <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => Promise<pg.QueryResult<T>>;
  connect: () => Promise<{
    query: <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => Promise<pg.QueryResult<T>>;
    release: () => void;
  }>;
} {
  const createMemoryClient = () => ({
    query: async <T extends pg.QueryResultRow = any>(text: string, params?: any[]) =>
      executeInMemoryQuery<T>(text, params),
    release: () => {},
  });

  if (useMemoryFallback) {
    return {
      query: async <T extends pg.QueryResultRow = any>(text: string, params?: any[]) =>
        executeInMemoryQuery<T>(text, params),
      connect: async () => createMemoryClient(),
    };
  }

  if (!pool) {
    const connectionString = getDatabaseUrl();
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });

    pool.on("error", (err) => {
      console.warn("PostgreSQL pool error, enabling in-memory fallback:", err.message);
      useMemoryFallback = true;
    });
  }

  return {
    query: async <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => {
      if (useMemoryFallback) {
        return executeInMemoryQuery<T>(text, params);
      }
      try {
        return await (pool as pg.Pool).query<T>(text, params);
      } catch (err: any) {
        console.warn(`[DB] PostgreSQL query failed (${err.message}). Falling back to in-memory store.`);
        useMemoryFallback = true;
        return executeInMemoryQuery<T>(text, params);
      }
    },
    connect: async () => {
      if (useMemoryFallback) {
        return createMemoryClient();
      }
      try {
        const client = await (pool as pg.Pool).connect();
        return {
          query: (text: string, params?: any[]) => client.query(text, params),
          release: () => client.release(),
        };
      } catch (err: any) {
        console.warn(`[DB] PostgreSQL connect failed (${err.message}). Falling back to in-memory store.`);
        useMemoryFallback = true;
        return createMemoryClient();
      }
    },
  };
}

/**
 * Set custom pool (useful for unit/integration testing mocks).
 */
export function setPool(customPool: pg.Pool | null): void {
  pool = customPool;
  useMemoryFallback = false;
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
    await pool.end().catch(() => {});
    pool = null;
  }
}
