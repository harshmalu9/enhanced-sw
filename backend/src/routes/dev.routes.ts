import { Router, type Request, type Response } from "express";
import { seedDemoData } from "../db/seed.js";

const router: Router = Router();

/**
 * POST /api/dev/seed
 * Seed realistic historical expenses, anomalies, and current monthly budget for demo purposes.
 */
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedDemoData({ clearExisting: true });
    return res.status(200).json({
      success: true,
      message: `Demo data loaded successfully: ${result.expensesCount} expenses and ${result.budgetsCount} budget configurations created.`,
      data: result,
    });
  } catch (err: unknown) {
    console.error("Error seeding demo data:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "SEED_FAILED",
        message: err instanceof Error ? err.message : "Failed to seed demo data in database.",
      },
    });
  }
});

export default router;
