import { ExpenseCategory } from "./expense";

export interface ExpenseInput {
  description: string;
  amount: number;
  category: ExpenseCategory | string;
  merchant?: string;
  date?: string;
}

export interface PeriodInput {
  start?: string;
  end?: string;
}

export interface HighestCategoryResult {
  category: string;
  amount: number;
  percentage: number;
}

export interface LargestExpenseResult {
  description: string;
  amount: number;
  category: string;
  merchant?: string | null;
}

export interface SpendingSummaryResult {
  total_spending: number;
  expense_count: number;
  average_expense: number;
  spending_by_category: Record<string, number>;
  category_percentages: Record<string, number>;
  highest_spending_category?: HighestCategoryResult | null;
  largest_expense?: LargestExpenseResult | null;
}

export interface SpendingInsightsDataResult {
  summary: SpendingSummaryResult;
  insights: string[];
  period?: PeriodInput | null;
}

export interface SpendingInsightsResponse {
  success: boolean;
  data: SpendingInsightsDataResult;
  error?: {
    code: string;
    message: string;
  };
}
