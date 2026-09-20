import { Router, type Request, type Response } from "express";

const router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

router.post("/insights", async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenses, period } = req.body || {};

    // 1. Validate expenses array
    if (!expenses || !Array.isArray(expenses)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EXPENSES",
          message: "'expenses' field is required and must be an array.",
        },
      });
      return;
    }

    // 2. Validate each expense item in array
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

    // 3. Forward request to Python AI service
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
          period: period && typeof period === "object" ? period : undefined,
        }),
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
    console.error("Unexpected error in /api/spending/insights proxy:", err);
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
