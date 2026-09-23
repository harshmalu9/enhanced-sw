import { Router, type Request, type Response } from "express";

const router: Router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

/**
 * POST /api/settlement/simplify
 * Simplifies group debts and generates minimal cash-flow settlements.
 */
router.post("/simplify", async (req: Request, res: Response): Promise<void> => {
  const { title, payments } = req.body || {};

  if (!payments || !Array.isArray(payments) || payments.length < 2) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYMENTS",
        message: "Group debt simplification requires an array of at least 2 participant payments.",
      },
    });
    return;
  }

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    if (!p || typeof p !== "object" || typeof p.person !== "string" || !p.person.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PARTICIPANT",
          message: `Participant at index ${i} requires a non-empty 'person' name.`,
        },
      });
      return;
    }

    const amt = typeof p.amount_paid === "number" ? p.amount_paid : Number(p.amount_paid);
    if (isNaN(amt) || !isFinite(amt) || amt < 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AMOUNT",
          message: `Participant '${p.person}' must have a valid non-negative 'amount_paid'.`,
        },
      });
      return;
    }
  }

  const aiServiceUrl = getAiServiceUrl();
  const targetUrl = `${aiServiceUrl}/api/settlement/simplify`;

  try {
    const aiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title || "Group Expense Settlement",
        payments,
      }),
    });

    const contentType = aiResponse.headers.get("content-type");
    let responseData: unknown;
    if (contentType && contentType.includes("application/json")) {
      responseData = await aiResponse.json();
    } else {
      const text = await aiResponse.text();
      responseData = { success: aiResponse.ok, message: text };
    }

    res.status(aiResponse.status).json(responseData);
  } catch (networkError: unknown) {
    console.error("Failed to connect to AI service for settlement:", networkError);
    res.status(503).json({
      success: false,
      error: {
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI service is currently unavailable. Please try again.",
      },
    });
  }
});

export default router;
