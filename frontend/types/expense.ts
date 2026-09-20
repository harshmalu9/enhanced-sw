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
