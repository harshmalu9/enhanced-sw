import { getBudgetRepository, BudgetRepository } from "./budget.repository.js";
import { getExpenseRepository, ExpenseRepository } from "./expense.repository.js";
import type { BudgetRecord, BudgetStatus, CategoryBudgetStatus, UpsertBudgetPayload } from "../types/budget.js";
import { CANONICAL_CATEGORIES } from "../constants/categories.js";

export class BudgetService {
  constructor(
    private budgetRepo: BudgetRepository = getBudgetRepository(),
    private expenseRepo: ExpenseRepository = getExpenseRepository()
  ) {}

  /**
   * Deterministically calculates status based on percentage used.
   */
  private calculateStatus(spent: number, limit: number): "NORMAL" | "WARNING" | "EXCEEDED" {
    if (limit <= 0) return spent > 0 ? "EXCEEDED" : "NORMAL";
    const ratio = spent / limit;
    if (ratio > 1.0) return "EXCEEDED";
    if (ratio >= 0.8) return "WARNING";
    return "NORMAL";
  }

  async getBudgetStatus(monthYear?: string): Promise<BudgetStatus | null> {
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const budget = await this.budgetRepo.getBudgetByMonth(targetMonth);

    if (!budget) {
      return null;
    }

    // Fetch all expenses
    const allExpenses = await this.expenseRepo.findAll();

    // Filter expenses falling in the target month 'YYYY-MM'
    const monthExpenses = allExpenses.filter((e: any) => {
      const d = e.date || e.expenseDate || "";
      return d.startsWith(targetMonth);
    });

    // Aggregate deterministic spending
    let totalSpent = 0;
    const categorySpentMap: Record<string, number> = {};

    for (const exp of monthExpenses) {
      totalSpent += exp.amount;
      categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + exp.amount;
    }

    totalSpent = Math.round(totalSpent * 100) / 100;
    const remainingAmount = Math.round((budget.monthlyBudget - totalSpent) * 100) / 100;
    const percentageUsed = budget.monthlyBudget > 0
      ? Math.round((totalSpent / budget.monthlyBudget) * 10000) / 100
      : (totalSpent > 0 ? 100 : 0);

    const status = this.calculateStatus(totalSpent, budget.monthlyBudget);

    // Compute category-specific budget statuses
    const categoryStatuses: CategoryBudgetStatus[] = [];
    for (const [category, limit] of Object.entries(budget.categoryBudgets)) {
      if (limit > 0) {
        const catSpent = Math.round((categorySpentMap[category] || 0) * 100) / 100;
        const catRemaining = Math.round((limit - catSpent) * 100) / 100;
        const catPct = Math.round((catSpent / limit) * 10000) / 100;
        categoryStatuses.push({
          category,
          budgetLimit: limit,
          spent: catSpent,
          remainingAmount: catRemaining,
          percentageUsed: catPct,
          status: this.calculateStatus(catSpent, limit),
        });
      }
    }

    // Sort category statuses: EXCEEDED first, then WARNING, then by spent desc
    categoryStatuses.sort((a, b) => {
      const order = { EXCEEDED: 0, WARNING: 1, NORMAL: 2 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return b.spent - a.spent;
    });

    return {
      monthYear: targetMonth,
      monthlyBudget: budget.monthlyBudget,
      totalSpent,
      remainingAmount,
      percentageUsed,
      status,
      categoryStatuses,
    };
  }

  async setBudget(payload: UpsertBudgetPayload): Promise<BudgetRecord> {
    if (!payload.monthYear || !/^\d{4}-\d{2}$/.test(payload.monthYear)) {
      throw new Error("monthYear must be in 'YYYY-MM' format (e.g. '2026-09').");
    }

    if (typeof payload.monthlyBudget !== "number" || isNaN(payload.monthlyBudget) || payload.monthlyBudget < 0) {
      throw new Error("monthlyBudget must be a non-negative number.");
    }

    if (payload.categoryBudgets) {
      for (const [cat, limit] of Object.entries(payload.categoryBudgets)) {
        if (!CANONICAL_CATEGORIES.includes(cat as any)) {
          throw new Error(`Invalid category '${cat}'. Must be one of canonical categories.`);
        }
        if (typeof limit !== "number" || isNaN(limit) || limit < 0) {
          throw new Error(`Budget limit for '${cat}' must be a non-negative number.`);
        }
      }
    }

    return this.budgetRepo.upsertBudget(payload);
  }

  async getBudgetRecord(monthYear?: string): Promise<BudgetRecord | null> {
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7);
    return this.budgetRepo.getBudgetByMonth(targetMonth);
  }

  async getAllBudgets(): Promise<BudgetRecord[]> {
    return this.budgetRepo.getAllBudgets();
  }

  async deleteBudget(monthYear: string): Promise<boolean> {
    return this.budgetRepo.deleteBudget(monthYear);
  }
}

let budgetServiceInstance: BudgetService | null = null;
export function getBudgetService(): BudgetService {
  if (!budgetServiceInstance) {
    budgetServiceInstance = new BudgetService();
  }
  return budgetServiceInstance;
}
