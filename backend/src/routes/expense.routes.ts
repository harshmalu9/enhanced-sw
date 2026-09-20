import { Router, type Request, type Response } from "express";

const router = Router();

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

router.post("/categorize", async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, amount, merchant } = req.body || {};

    // 1. Validate description (required, non-empty string)
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

    // 2. Validate amount if provided
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

    // 3. Validate merchant if provided
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

    // 4. Forward request to Python AI service
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
