import { normalizeCategory } from "../constants/categories.js";
import {
  expenseRepository,
  type CreateExpenseDTO,
  type ExpenseRecord,
  type ExpenseRepository,
} from "./expense.repository.js";

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

export interface CreateExpenseInput {
  description: string;
  amount: number;
  category?: string;
  merchant?: string | null;
  date?: string | null;
}

export class ExpenseService {
  constructor(private repo: ExpenseRepository = expenseRepository) {}

  /**
   * Automatically categorizes (if category omitted) and saves a new expense to PostgreSQL.
   */
  async createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
    const { description, amount, merchant, date } = input;

    if (typeof description !== "string" || !description.trim()) {
      throw new Error("VALIDATION_ERROR: Expense description is required.");
    }

    const parsedAmount = typeof amount === "number" ? amount : Number(amount);
    if (amount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 0) {
      throw new Error("VALIDATION_ERROR: Amount must be a valid non-negative number.");
    }

    let finalCategory = input.category ? normalizeCategory(input.category) : null;

    // If category is omitted or empty, perform automatic categorization via Python AI service
    if (!finalCategory) {
      const aiServiceUrl = getAiServiceUrl();
      const categorizeUrl = `${aiServiceUrl}/api/expense/categorize`;

      let aiResponse: globalThis.Response;
      try {
        aiResponse = await fetch(categorizeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            amount: parsedAmount,
            merchant: merchant ? merchant.trim() : undefined,
          }),
        });
      } catch (err: unknown) {
        console.error("Failed to connect to AI categorization service:", err);
        throw new Error("AI_SERVICE_UNAVAILABLE: Could not connect to AI service for categorization.");
      }

      if (!aiResponse.ok) {
        let errCode = "AI_CATEGORIZATION_FAILED";
        let errMsg = "AI service failed to categorize expense.";
        try {
          const errData = (await aiResponse.json()) as any;
          if (errData?.error?.message) errMsg = errData.error.message;
          if (errData?.error?.code) errCode = errData.error.code;
        } catch {}
        throw new Error(`${errCode}: ${errMsg}`);
      }

      const aiData = (await aiResponse.json()) as any;
      const rawCategory = aiData?.data?.category;
      finalCategory = normalizeCategory(rawCategory);

      if (!finalCategory) {
        throw new Error(
          `AI_INVALID_CATEGORY: AI returned non-canonical category '${rawCategory}'.`
        );
      }
    }

    const createDto: CreateExpenseDTO = {
      description: description.trim(),
      amount: parsedAmount,
      category: finalCategory,
      merchant: merchant && typeof merchant === "string" ? merchant.trim() : null,
      date: date && typeof date === "string" && date.trim() ? date.trim() : null,
    };

    return this.repo.create(createDto);
  }

  async listExpenses(): Promise<ExpenseRecord[]> {
    return this.repo.findAll();
  }

  async getExpenseById(id: string): Promise<ExpenseRecord | null> {
    if (!id || typeof id !== "string") return null;
    return this.repo.findById(id);
  }

  async deleteExpenseById(id: string): Promise<boolean> {
    if (!id || typeof id !== "string") return false;
    return this.repo.deleteById(id);
  }
}

export const expenseService = new ExpenseService();
