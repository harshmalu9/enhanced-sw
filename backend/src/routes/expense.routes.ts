import { Router, type Request, type Response } from "express";
import { expenseService } from "../services/expense.service.js";

const router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

/**
 * POST /api/expenses
 * Create and persist a new expense in PostgreSQL (with automatic AI categorization if category is omitted).
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, amount, category, merchant, date } = req.body || {};

    if (typeof description !== "string" || !description.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_DESCRIPTION",
          message: "Expense description is required and must not be empty.",
        },
      });
      return;
    }

    const parsedAmount = typeof amount === "number" ? amount : Number(amount);
    if (amount === undefined || isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AMOUNT",
          message: "Amount must be a valid non-negative number.",
        },
      });
      return;
    }

    const savedExpense = await expenseService.createExpense({
      description,
      amount: parsedAmount,
      category: category && typeof category === "string" ? category : undefined,
      merchant: merchant && typeof merchant === "string" ? merchant : null,
      date: date && typeof date === "string" ? date : null,
    });

    res.status(201).json({
      success: true,
      data: savedExpense,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.startsWith("VALIDATION_ERROR:")) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: errMsg.replace("VALIDATION_ERROR:", "").trim(),
        },
      });
      return;
    }

    if (errMsg.startsWith("AI_SERVICE_UNAVAILABLE:")) {
      res.status(503).json({
        success: false,
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "AI service is currently unavailable for categorization. Please try again.",
        },
      });
      return;
    }

    if (errMsg.startsWith("AI_CATEGORIZATION_FAILED:") || errMsg.startsWith("AI_INVALID_CATEGORY:")) {
      res.status(502).json({
        success: false,
        error: {
          code: "AI_CATEGORIZATION_ERROR",
          message: "Failed to automatically categorize expense.",
        },
      });
      return;
    }

    console.error("Unexpected error in POST /api/expenses:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while saving the expense.",
      },
    });
  }
});

/**
 * GET /api/expenses
 * List all persisted expenses in newest-first order.
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const expenses = await expenseService.listExpenses();
    res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/expenses:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve expenses from database.",
      },
    });
  }
});

/**
 * GET /api/expenses/:id
 * Retrieve a single expense by ID.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const expense = await expenseService.getExpenseById(id);

    if (!expense) {
      res.status(404).json({
        success: false,
        error: {
          code: "EXPENSE_NOT_FOUND",
          message: `Expense with ID '${id}' was not found.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (err: unknown) {
    console.error(`Error in GET /api/expenses/${req.params.id}:`, err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve expense from database.",
      },
    });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense by ID.
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await expenseService.deleteExpenseById(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: "EXPENSE_NOT_FOUND",
          message: `Expense with ID '${id}' was not found.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id,
        deleted: true,
      },
    });
  } catch (err: unknown) {
    console.error(`Error in DELETE /api/expenses/${req.params.id}:`, err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete expense from database.",
      },
    });
  }
});

/**
 * POST /api/expenses/categorize
 * Lower-level AI categorization proxy (preserved for AI service reuse/direct testing).
 */
router.post("/categorize", async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, amount, merchant } = req.body || {};

    if (typeof description !== "string" || !description.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_DESCRIPTION",
          message: "Expense description is required and must not be empty.",
        },
      });
      return;
    }

    const cleanDescription = description.trim();

    let cleanAmount: number | undefined = undefined;
    if (amount !== undefined && amount !== null && amount !== "") {
      const parsedAmount = typeof amount === "number" ? amount : Number(amount);
      if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 0) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_AMOUNT",
            message: "Amount must be a valid non-negative number.",
          },
        });
        return;
      }
      cleanAmount = parsedAmount;
    }

    let cleanMerchant: string | undefined = undefined;
    if (merchant !== undefined && merchant !== null) {
      if (typeof merchant !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MERCHANT",
            message: "Merchant must be a string.",
          },
        });
        return;
      }
      const trimmedMerchant = merchant.trim();
      cleanMerchant = trimmedMerchant.length > 0 ? trimmedMerchant : undefined;
    }

    const aiServiceUrl = getAiServiceUrl();
    const targetUrl = `${aiServiceUrl}/api/expense/categorize`;

    const requestPayload = {
      description: cleanDescription,
      amount: cleanAmount,
      merchant: cleanMerchant,
    };

    let aiResponse: globalThis.Response;
    try {
      aiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (networkError: unknown) {
      console.error("Failed to connect to AI service at", targetUrl, networkError);
      res.status(503).json({
        success: false,
        error: {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "AI service is currently unavailable. Please try again.",
        },
      });
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

    res.status(responseStatus).json(responseData);
  } catch (err: unknown) {
    console.error("Unexpected error in /api/expenses/categorize proxy:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while categorizing the expense.",
      },
    });
  }
});

export default router;
