import { Router, type Request, type Response } from "express";
import { expenseRepository } from "../services/expense.repository.js";

const router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

async function forwardToPythonInsights(
  expenses: Array<{
    description: string;
    amount: number;
    category: string;
    merchant?: string | null;
    date?: string | null;
  }>,
  period?: { start?: string; end?: string },
  res?: Response
): Promise<any> {
  const aiServiceUrl = getAiServiceUrl();
  const targetUrl = `${aiServiceUrl}/api/spending/insights`;

  let aiResponse: globalThis.Response;
  try {
    aiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expenses,
        period,
      }),
    });
  } catch (networkError: unknown) {
    console.error("Failed to connect to AI service at", targetUrl, networkError);
    if (res) {
      res.status(503).json({
        success: false,
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "AI service is currently unavailable. Please try again.",
        },
      });
    }
    return;
  }

  const responseStatus = aiResponse.status;
  let responseData: unknown;
  const contentType = aiResponse.headers.get("content-type");

  if (contentType && contentType.includes("application/json")) {
    responseData = await aiResponse.json();
  } else {
    const text = await aiResponse.text();
    responseData = {
      success: aiResponse.ok,
      message: text,
    };
  }

  if (res) {
    res.status(responseStatus).json(responseData);
  }
  return responseData;
}

/**
 * GET /api/spending/insights
 * Generates spending summary and AI insights from persisted PostgreSQL expenses.
 */
router.get("/insights", async (req: Request, res: Response): Promise<void> => {
  try {
    const periodParam = req.query.period as string | undefined;
    let periodObj: { start?: string; end?: string } | undefined = undefined;

    if (periodParam === "month" || periodParam === "current_month") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const today = now.toISOString().split("T")[0];
      periodObj = { start: startOfMonth, end: today };
    }

    // 1. Fetch expenses from PostgreSQL
    const storedExpenses = await expenseRepository.findAll();

    // 2. Format expenses for Python AI service
    const formattedExpenses = storedExpenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      merchant: e.merchant || undefined,
      date: e.date,
    }));

    // 3. Forward to Python AI service
    await forwardToPythonInsights(formattedExpenses, periodObj, res);
  } catch (err: unknown) {
    console.error("Error in GET /api/spending/insights:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while generating spending insights.",
      },
    });
  }
});

/**
 * POST /api/spending/insights
 * Allows custom expense payload or fallback to database expenses.
 */
router.post("/insights", async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenses, period } = req.body || {};

    // If explicit expenses array provided, validate and forward
    if (expenses !== undefined) {
      if (!Array.isArray(expenses)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_EXPENSES",
            message: "'expenses' field must be an array.",
          },
        });
        return;
      }

      for (let i = 0; i < expenses.length; i++) {
        const item = expenses[i];
        if (!item || typeof item !== "object") {
          res.status(400).json({
            success: false,
            error: {
              code: "INVALID_EXPENSE_ITEM",
              message: `Expense at index ${i} must be an object.`,
            },
          });
          return;
        }

        if (typeof item.description !== "string" || !item.description.trim()) {
          res.status(400).json({
            success: false,
            error: {
              code: "MISSING_DESCRIPTION",
              message: `Expense at index ${i} requires a non-empty description.`,
            },
          });
          return;
        }

        const parsedAmount = typeof item.amount === "number" ? item.amount : Number(item.amount);
        if (item.amount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 0) {
          res.status(400).json({
            success: false,
            error: {
              code: "INVALID_AMOUNT",
              message: `Expense at index ${i} must have a valid non-negative amount.`,
            },
          });
          return;
        }

        if (typeof item.category !== "string" || !item.category.trim()) {
          res.status(400).json({
            success: false,
            error: {
              code: "MISSING_CATEGORY",
              message: `Expense at index ${i} requires a category.`,
            },
          });
          return;
        }
      }

      await forwardToPythonInsights(expenses, period, res);
      return;
    }

    // If expenses not provided in body, load from database
    const storedExpenses = await expenseRepository.findAll();
    const formattedExpenses = storedExpenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      merchant: e.merchant || undefined,
      date: e.date,
    }));

    await forwardToPythonInsights(formattedExpenses, period, res);
  } catch (err: unknown) {
    console.error("Unexpected error in POST /api/spending/insights proxy:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while generating spending insights.",
      },
    });
  }
});

export default router;
