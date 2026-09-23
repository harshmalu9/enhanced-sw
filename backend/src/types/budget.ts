export interface BudgetRecord {
  id: string;
  monthYear: string; // 'YYYY-MM'
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  monthYear: string;
  monthlyBudget: number;
  totalSpent: number;
  remainingAmount: number;
  percentageUsed: number;
  status: "NORMAL" | "WARNING" | "EXCEEDED"; // NORMAL (<80%), WARNING (80-100%), EXCEEDED (>100%)
  categoryStatuses: CategoryBudgetStatus[];
}

export interface CategoryBudgetStatus {
  category: string;
  budgetLimit: number;
  spent: number;
  remainingAmount: number;
  percentageUsed: number;
  status: "NORMAL" | "WARNING" | "EXCEEDED";
}

export interface UpsertBudgetPayload {
  monthYear: string; // 'YYYY-MM'
  monthlyBudget: number;
  categoryBudgets?: Record<string, number>;
}
