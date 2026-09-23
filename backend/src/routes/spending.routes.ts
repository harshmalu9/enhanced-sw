import { Router, type Request, type Response } from "express";
import { expenseRepository } from "../services/expense.repository.js";

const router: Router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

async function forwardToPython(
  endpoint: string,
  payload: any,
  res?: Response
): Promise<any> {
  const aiServiceUrl = getAiServiceUrl();
  const targetUrl = `${aiServiceUrl}${endpoint}`;

  let aiResponse: globalThis.Response;
  try {
    aiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError: unknown) {
    console.error(`Failed to connect to AI service at ${targetUrl}:`, networkError);
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

    const storedExpenses = await expenseRepository.findAll();
    const formattedExpenses = storedExpenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      merchant: e.merchant || undefined,
      date: e.date,
    }));

    await forwardToPython("/api/spending/insights", { expenses: formattedExpenses, period: periodObj }, res);
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
 */
router.post("/insights", async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenses, period } = req.body || {};

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

      await forwardToPython("/api/spending/insights", { expenses, period }, res);
      return;
    }

    const storedExpenses = await expenseRepository.findAll();
    const formattedExpenses = storedExpenses.map((e) => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      merchant: e.merchant || undefined,
      date: e.date,
    }));

    await forwardToPython("/api/spending/insights", { expenses: formattedExpenses, period }, res);
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

/**
 * GET /api/spending/anomalies
 * Detects statistical anomalies in persisted PostgreSQL expenses.
 */
router.get("/anomalies", async (_req: Request, res: Response): Promise<void> => {
  try {
    const storedExpenses = await expenseRepository.findAll();
    const formatted = storedExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      category: e.category,
      merchant: e.merchant || undefined,
      expense_date: e.date,
    }));

    await forwardToPython("/api/spending/anomalies", { expenses: formatted }, res);
  } catch (err: unknown) {
    console.error("Error in GET /api/spending/anomalies:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to perform anomaly detection.",
      },
    });
  }
});

/**
 * POST /api/spending/anomalies
 */
router.post("/anomalies", async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenses, sensitivity_factor } = req.body || {};
    if (expenses !== undefined && !Array.isArray(expenses)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EXPENSES",
          message: "'expenses' field must be an array.",
        },
      });
      return;
    }

    let payloadExpenses = expenses;
    if (!payloadExpenses) {
      const storedExpenses = await expenseRepository.findAll();
      payloadExpenses = storedExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category,
        merchant: e.merchant || undefined,
        expense_date: e.date,
      }));
    }

    await forwardToPython(
      "/api/spending/anomalies",
      { expenses: payloadExpenses, sensitivity_factor },
      res
    );
  } catch (err: unknown) {
    console.error("Error in POST /api/spending/anomalies:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to perform anomaly detection.",
      },
    });
  }
});

/**
 * GET /api/spending/forecast
 * Forecasts future spending trajectory using persisted PostgreSQL expenses.
 */
router.get("/forecast", async (req: Request, res: Response): Promise<void> => {
  try {
    const horizonParam = req.query.horizon ? parseInt(req.query.horizon as string, 10) : 14;
    const storedExpenses = await expenseRepository.findAll();
    const formatted = storedExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      category: e.category,
      expense_date: e.date,
    }));

    await forwardToPython("/api/spending/forecast", { expenses: formatted, horizon_days: horizonParam }, res);
  } catch (err: unknown) {
    console.error("Error in GET /api/spending/forecast:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate spending forecast.",
      },
    });
  }
});

/**
 * POST /api/spending/forecast
 */
router.post("/forecast", async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenses, horizon_days } = req.body || {};
    if (expenses !== undefined && !Array.isArray(expenses)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EXPENSES",
          message: "'expenses' field must be an array.",
        },
      });
      return;
    }

    let payloadExpenses = expenses;
    if (!payloadExpenses) {
      const storedExpenses = await expenseRepository.findAll();
      payloadExpenses = storedExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category,
        expense_date: e.date,
      }));
    }

    await forwardToPython("/api/spending/forecast", { expenses: payloadExpenses, horizon_days }, res);
  } catch (err: unknown) {
    console.error("Error in POST /api/spending/forecast:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate spending forecast.",
      },
    });
  }
});

export default router;
