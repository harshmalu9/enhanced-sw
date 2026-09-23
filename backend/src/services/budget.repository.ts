import { getPool } from "../db/client.js";
import type { BudgetRecord, UpsertBudgetPayload } from "../types/budget.js";

interface BudgetRow {
  id: string;
  month_year: string;
  monthly_budget: string | number;
  category_budgets: Record<string, number> | string;
  created_at: Date;
  updated_at: Date;
}

export class BudgetRepository {
  private formatRow(row: BudgetRow): BudgetRecord {
    let categoryBudgets: Record<string, number> = {};
    if (typeof row.category_budgets === "string") {
      try {
        categoryBudgets = JSON.parse(row.category_budgets);
      } catch {
        categoryBudgets = {};
      }
    } else if (row.category_budgets && typeof row.category_budgets === "object") {
      categoryBudgets = row.category_budgets;
    }

    return {
      id: row.id,
      monthYear: row.month_year,
      monthlyBudget: parseFloat(String(row.monthly_budget)),
      categoryBudgets,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async getBudgetByMonth(monthYear: string): Promise<BudgetRecord | null> {
    const pool = getPool();
    const query = `
      SELECT id, month_year, monthly_budget, category_budgets, created_at, updated_at
      FROM budgets
      WHERE month_year = $1
    `;
    const result = await pool.query<BudgetRow>(query, [monthYear]);
    if (result.rows.length === 0) return null;
    return this.formatRow(result.rows[0]);
  }

  async upsertBudget(payload: UpsertBudgetPayload): Promise<BudgetRecord> {
    const pool = getPool();
    const categoryBudgetsJson = JSON.stringify(payload.categoryBudgets || {});
    const query = `
      INSERT INTO budgets (month_year, monthly_budget, category_budgets, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (month_year)
      DO UPDATE SET
        monthly_budget = EXCLUDED.monthly_budget,
        category_budgets = EXCLUDED.category_budgets,
        updated_at = NOW()
      RETURNING id, month_year, monthly_budget, category_budgets, created_at, updated_at
    `;
    const result = await pool.query<BudgetRow>(query, [
      payload.monthYear,
      payload.monthlyBudget,
      categoryBudgetsJson,
    ]);
    return this.formatRow(result.rows[0]);
  }

  async getAllBudgets(): Promise<BudgetRecord[]> {
    const pool = getPool();
    const query = `
      SELECT id, month_year, monthly_budget, category_budgets, created_at, updated_at
      FROM budgets
      ORDER BY month_year DESC
    `;
    const result = await pool.query<BudgetRow>(query);
    return result.rows.map((row) => this.formatRow(row));
  }

  async deleteBudget(monthYear: string): Promise<boolean> {
    const pool = getPool();
    const query = `DELETE FROM budgets WHERE month_year = $1`;
    const result = await pool.query(query, [monthYear]);
    return (result.rowCount ?? 0) > 0;
  }
}

let budgetRepositoryInstance: BudgetRepository | null = null;
export function getBudgetRepository(): BudgetRepository {
  if (!budgetRepositoryInstance) {
    budgetRepositoryInstance = new BudgetRepository();
  }
  return budgetRepositoryInstance;
}
