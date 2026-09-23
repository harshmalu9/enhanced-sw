import { Router, type Request, type Response } from "express";
import { getBudgetService } from "../services/budget.service.js";

const router: Router = Router();

/**
 * GET /api/budgets/current
 * Returns the current month's budget status, spent amount, remaining amount, and category breakdowns.
 */
router.get("/current", async (_req: Request, res: Response) => {
  try {
    const budgetService = getBudgetService();
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const status = await budgetService.getBudgetStatus(currentMonth);

    if (!status) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No budget configured for the current month.",
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err: unknown) {
    console.error("Error retrieving current budget status:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "BUDGET_FETCH_ERROR",
        message: "Failed to retrieve current budget status.",
      },
    });
  }
});

/**
 * GET /api/budgets/:month
 * Returns budget status for a specific month (e.g. '2026-09').
 */
router.get("/:month", async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MONTH_FORMAT",
          message: "Month must be in 'YYYY-MM' format (e.g. '2026-09').",
        },
      });
    }

    const budgetService = getBudgetService();
    const status = await budgetService.getBudgetStatus(month);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: "BUDGET_NOT_FOUND",
          message: `No budget configured for month '${month}'.`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err: unknown) {
    console.error(`Error retrieving budget status for ${req.params.month}:`, err);
    return res.status(500).json({
      success: false,
      error: {
        code: "BUDGET_FETCH_ERROR",
        message: "Failed to retrieve budget status.",
      },
    });
  }
});

/**
 * POST /api/budgets
 * Upsert monthly budget with optional category allocations.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { monthYear, monthlyBudget, categoryBudgets } = req.body;

    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MONTH_FORMAT",
          message: "monthYear must be provided in 'YYYY-MM' format.",
        },
      });
    }

    if (typeof monthlyBudget !== "number" || isNaN(monthlyBudget) || monthlyBudget < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_BUDGET_AMOUNT",
          message: "monthlyBudget must be a non-negative number.",
        },
      });
    }

    const budgetService = getBudgetService();
    const createdRecord = await budgetService.setBudget({
      monthYear,
      monthlyBudget,
      categoryBudgets: categoryBudgets || {},
    });

    // Also return computed status
    const status = await budgetService.getBudgetStatus(monthYear);

    return res.status(200).json({
      success: true,
      data: {
        record: createdRecord,
        status,
      },
    });
  } catch (err: unknown) {
    console.error("Error saving budget:", err);
    return res.status(400).json({
      success: false,
      error: {
        code: "BUDGET_SAVE_ERROR",
        message: err instanceof Error ? err.message : "Failed to save budget.",
      },
    });
  }
});

/**
 * DELETE /api/budgets/:month
 * Delete budget configuration for a specific month.
 */
router.delete("/:month", async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MONTH_FORMAT",
          message: "Month must be in 'YYYY-MM' format.",
        },
      });
    }

    const budgetService = getBudgetService();
    const deleted = await budgetService.deleteBudget(month);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "BUDGET_NOT_FOUND",
          message: `No budget found for month '${month}'.`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Budget for month '${month}' successfully deleted.`,
    });
  } catch (err: unknown) {
    console.error(`Error deleting budget for ${req.params.month}:`, err);
    return res.status(500).json({
      success: false,
      error: {
        code: "BUDGET_DELETE_ERROR",
        message: "Failed to delete budget.",
      },
    });
  }
});

export default router;
