import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BudgetService } from "./budget.service.js";
import type { BudgetRepository } from "./budget.repository.js";
import type { ExpenseRepository } from "./expense.repository.js";
import type { BudgetRecord, UpsertBudgetPayload } from "../types/budget.js";
import type { ExpenseRecord } from "../types/expense.js";

// Mock BudgetRepository
class MockBudgetRepository implements Partial<BudgetRepository> {
  private budgets: Map<string, BudgetRecord> = new Map();

  async getBudgetByMonth(monthYear: string): Promise<BudgetRecord | null> {
    return this.budgets.get(monthYear) || null;
  }

  async upsertBudget(payload: UpsertBudgetPayload): Promise<BudgetRecord> {
    const record: BudgetRecord = {
      id: "mock-budget-uuid",
      monthYear: payload.monthYear,
      monthlyBudget: payload.monthlyBudget,
      categoryBudgets: payload.categoryBudgets || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.budgets.set(payload.monthYear, record);
    return record;
  }

  async getAllBudgets(): Promise<BudgetRecord[]> {
    return Array.from(this.budgets.values());
  }

  async deleteBudget(monthYear: string): Promise<boolean> {
    return this.budgets.delete(monthYear);
  }
}

// Mock ExpenseRepository
class MockExpenseRepository implements Partial<ExpenseRepository> {
  private expenses: any[] = [];

  constructor(initialExpenses: any[] = []) {
    this.expenses = initialExpenses;
  }

  async findAll(): Promise<any[]> {
    return this.expenses;
  }
}

describe("Business Layer: BudgetService", () => {
  const sampleExpenses: ExpenseRecord[] = [
    {
      id: "1",
      description: "Restaurant dinner",
      amount: 4200.00,
      category: "Food & Dining",
      merchant: "Barbeque Nation",
      expenseDate: "2026-09-10",
      createdAt: "2026-09-10T12:00:00Z",
      updatedAt: "2026-09-10T12:00:00Z",
    },
    {
      id: "2",
      description: "Supermarket groceries",
      amount: 3000.00,
      category: "Groceries",
      merchant: "DMart",
      expenseDate: "2026-09-15",
      createdAt: "2026-09-15T12:00:00Z",
      updatedAt: "2026-09-15T12:00:00Z",
    },
    {
      id: "3",
      description: "Metro card recharge",
      amount: 500.00,
      category: "Transportation",
      merchant: "Metro Rail",
      expenseDate: "2026-09-18",
      createdAt: "2026-09-18T12:00:00Z",
      updatedAt: "2026-09-18T12:00:00Z",
    },
    {
      id: "4",
      description: "Old expense from August",
      amount: 5000.00,
      category: "Food & Dining",
      merchant: "Old Place",
      expenseDate: "2026-08-15",
      createdAt: "2026-08-15T12:00:00Z",
      updatedAt: "2026-08-15T12:00:00Z",
    },
  ];

  test("should return null when no budget is configured for month", async () => {
    const mockBudgetRepo = new MockBudgetRepository();
    const mockExpenseRepo = new MockExpenseRepository(sampleExpenses);
    const service = new BudgetService(mockBudgetRepo as any, mockExpenseRepo as any);

    const status = await service.getBudgetStatus("2026-09");
    assert.strictEqual(status, null);
  });

  test("should compute deterministic monthly and category budget status accurately", async () => {
    const mockBudgetRepo = new MockBudgetRepository();
    await mockBudgetRepo.upsertBudget({
      monthYear: "2026-09",
      monthlyBudget: 10000.00,
      categoryBudgets: {
        "Food & Dining": 5000.00,
        "Groceries": 2500.00, // will exceed (spent 3000)
        "Transportation": 1000.00,
      },
    });

    const mockExpenseRepo = new MockExpenseRepository(sampleExpenses);
    const service = new BudgetService(mockBudgetRepo as any, mockExpenseRepo as any);

    const status = await service.getBudgetStatus("2026-09");
    assert.ok(status);
    assert.strictEqual(status.monthYear, "2026-09");
    assert.strictEqual(status.monthlyBudget, 10000);
    // Total spent in Sep: 4200 + 3000 + 500 = 7700
    assert.strictEqual(status.totalSpent, 7700);
    assert.strictEqual(status.remainingAmount, 2300);
    assert.strictEqual(status.percentageUsed, 77);
    assert.strictEqual(status.status, "NORMAL");

    // Category statuses
    assert.strictEqual(status.categoryStatuses.length, 3);
    const groc = status.categoryStatuses.find((c) => c.category === "Groceries");
    assert.ok(groc);
    assert.strictEqual(groc.spent, 3000);
    assert.strictEqual(groc.budgetLimit, 2500);
    assert.strictEqual(groc.remainingAmount, -500);
    assert.strictEqual(groc.percentageUsed, 120);
    assert.strictEqual(groc.status, "EXCEEDED");

    const food = status.categoryStatuses.find((c) => c.category === "Food & Dining");
    assert.ok(food);
    assert.strictEqual(food.spent, 4200);
    assert.strictEqual(food.percentageUsed, 84);
    assert.strictEqual(food.status, "WARNING"); // >= 80%
  });

  test("should validate budget payload and reject invalid format or amounts", async () => {
    const mockBudgetRepo = new MockBudgetRepository();
    const mockExpenseRepo = new MockExpenseRepository();
    const service = new BudgetService(mockBudgetRepo as any, mockExpenseRepo as any);

    await assert.rejects(
      async () => service.setBudget({ monthYear: "invalid", monthlyBudget: 1000 }),
      /monthYear must be in 'YYYY-MM' format/
    );

    await assert.rejects(
      async () => service.setBudget({ monthYear: "2026-09", monthlyBudget: -500 }),
      /monthlyBudget must be a non-negative number/
    );

    await assert.rejects(
      async () =>
        service.setBudget({
          monthYear: "2026-09",
          monthlyBudget: 5000,
          categoryBudgets: { "NonExistentCategory": 1000 },
        }),
      /Invalid category 'NonExistentCategory'/
    );
  });
});
