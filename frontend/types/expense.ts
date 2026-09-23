export type ExpenseCategory =
  | "Food & Dining"
  | "Transportation"
  | "Shopping"
  | "Entertainment"
  | "Bills & Utilities"
  | "Healthcare"
  | "Education"
  | "Travel"
  | "Groceries"
  | "Personal Care"
  | "Other";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory | string;
  merchant?: string | null;
  date: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpenseParams {
  description: string;
  amount: number;
  category?: ExpenseCategory | string;
  merchant?: string;
  date?: string;
}

export interface CreateExpenseResponse {
  success: boolean;
  data: ExpenseRecord;
  error?: {
    code: string;
    message: string;
  };
}

export interface ListExpensesResponse {
  success: boolean;
  data: ExpenseRecord[];
  error?: {
    code: string;
    message: string;
  };
}

export interface ExpenseCategorizeParams {
  description: string;
  amount?: number;
  merchant?: string;
}

export interface ExpenseCategoryResult {
  category: ExpenseCategory | string;
  confidence: ConfidenceLevel | string;
}

export interface ExpenseCategorizeResponse {
  success: boolean;
  data: ExpenseCategoryResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface DeleteExpenseResponse {
  success: boolean;
  data: {
    id: string;
    deleted: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}




