export interface CategoryBudgetStatus {
  category: string;
  budgetLimit: number;
  spent: number;
  remainingAmount: number;
  percentageUsed: number;
  status: "NORMAL" | "WARNING" | "EXCEEDED";
}

export interface BudgetStatus {
  monthYear: string; // 'YYYY-MM'
  monthlyBudget: number;
  totalSpent: number;
  remainingAmount: number;
  percentageUsed: number;
  status: "NORMAL" | "WARNING" | "EXCEEDED";
  categoryStatuses: CategoryBudgetStatus[];
}

export interface BudgetRecord {
  id: string;
  monthYear: string;
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBudgetPayload {
  monthYear: string;
  monthlyBudget: number;
  categoryBudgets?: Record<string, number>;
}

export interface BudgetStatusResponse {
  success: boolean;
  data: BudgetStatus | null;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}
