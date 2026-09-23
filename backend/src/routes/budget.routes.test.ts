import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";
import { setPool } from "../db/client.js";

describe("Backend API: /api/budgets", () => {
  let server: http.Server;
  let baseUrl: string;
  let mockBudgets: any[] = [];
  let mockExpenses: any[] = [];

  before(async () => {
    // Mock PostgreSQL pool
    setPool({
      query: async (text: string, params?: any[]) => {
        if (text.includes("INSERT INTO budgets")) {
          const monthYear = params?.[0];
          const monthlyBudget = params?.[1];
          const categoryBudgets = params?.[2];

          const existingIdx = mockBudgets.findIndex((b) => b.month_year === monthYear);
          const row = {
            id: existingIdx !== -1 ? mockBudgets[existingIdx].id : "budget-uuid-1",
            month_year: monthYear,
            monthly_budget: String(monthlyBudget),
            category_budgets: typeof categoryBudgets === "string" ? JSON.parse(categoryBudgets) : categoryBudgets,
            created_at: new Date(),
            updated_at: new Date(),
          };

          if (existingIdx !== -1) {
            mockBudgets[existingIdx] = row;
          } else {
            mockBudgets.push(row);
          }
          return { rows: [row], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
        }

        if (text.includes("SELECT") && text.includes("FROM budgets WHERE month_year = $1")) {
          const monthYear = params?.[0];
          const found = mockBudgets.filter((b) => b.month_year === monthYear);
          return { rows: found, rowCount: found.length, command: "SELECT", oid: 0, fields: [] };
        }

        if (text.includes("SELECT") && text.includes("FROM budgets")) {
          return { rows: mockBudgets, rowCount: mockBudgets.length, command: "SELECT", oid: 0, fields: [] };
        }

        if (text.includes("DELETE FROM budgets WHERE month_year = $1")) {
          const monthYear = params?.[0];
          const idx = mockBudgets.findIndex((b) => b.month_year === monthYear);
          if (idx !== -1) {
            mockBudgets.splice(idx, 1);
            return { rows: [], rowCount: 1, command: "DELETE", oid: 0, fields: [] };
          }
          return { rows: [], rowCount: 0, command: "DELETE", oid: 0, fields: [] };
        }

        if (text.includes("SELECT") && text.includes("FROM expenses")) {
          return { rows: mockExpenses, rowCount: mockExpenses.length, command: "SELECT", oid: 0, fields: [] };
        }

        return { rows: [], rowCount: 0, command: "UNKNOWN", oid: 0, fields: [] };
      },
    } as any);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("POST /api/budgets should create/upsert a budget successfully", async () => {
    const testMonth = "2026-09";
    const payload = {
      monthYear: testMonth,
      monthlyBudget: 25000,
      categoryBudgets: {
        "Food & Dining": 5000,
        "Groceries": 4000,
      },
    };

    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.record.monthYear, testMonth);
    assert.strictEqual(body.data.record.monthlyBudget, 25000);
  });

  test("GET /api/budgets/:month should return budget and status", async () => {
    const res = await fetch(`${baseUrl}/api/budgets/2026-09`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.monthYear, "2026-09");
    assert.strictEqual(body.data.monthlyBudget, 25000);
    assert.ok(typeof body.data.totalSpent === "number");
    assert.ok(typeof body.data.remainingAmount === "number");
  });

  test("POST /api/budgets should return 400 on invalid payload", async () => {
    const res = await fetch(`${baseUrl}/api/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthYear: "invalid", monthlyBudget: -100 }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test("DELETE /api/budgets/:month should delete budget", async () => {
    const res = await fetch(`${baseUrl}/api/budgets/2026-09`, {
      method: "DELETE",
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });
});
