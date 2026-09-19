import { Router, type Request, type Response } from "express";
import multer from "multer";

const router = Router();

// Configure memory storage for receipt uploads (up to 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

const getAiServiceUrl = () => {
  return process.env.AI_SERVICE_URL || "http://localhost:8000";
};

router.post("/process", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FILE",
          message: "Receipt image file is required.",
        },
      });
      return;
    }

    const rawPeople = req.body.people;
    if (!rawPeople) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_PEOPLE",
          message: "Participant list is required.",
        },
      });
      return;
    }

    let parsedPeople: string[] = [];
    if (Array.isArray(rawPeople)) {
      parsedPeople = rawPeople.map((p) => String(p).trim()).filter(Boolean);
    } else if (typeof rawPeople === "string") {
      try {
        const parsed = JSON.parse(rawPeople);
        if (Array.isArray(parsed)) {
          parsedPeople = parsed.map((p) => String(p).trim()).filter(Boolean);
        } else {
          parsedPeople = rawPeople.split(",").map((p) => p.trim()).filter(Boolean);
        }
      } catch {
        parsedPeople = rawPeople.split(",").map((p) => p.trim()).filter(Boolean);
      }
    }

    if (parsedPeople.length < 2) {
      res.status(400).json({
        success: false,
        error: {
          code: "INSUFFICIENT_PARTICIPANTS",
          message: "At least two participants are required to split a bill.",
        },
      });
      return;
    }

    const instruction = typeof req.body.instruction === "string" ? req.body.instruction.trim() : "";
    if (!instruction) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_INSTRUCTION",
          message: "Natural-language consumption instruction is required.",
        },
      });
      return;
    }

    // Forward to Python AI service
    const aiServiceUrl = getAiServiceUrl();
    const targetUrl = `${aiServiceUrl}/api/bill/process`;

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
    formData.append("file", blob, file.originalname || "receipt.jpg");
    formData.append("people", JSON.stringify(parsedPeople));
    formData.append("instruction", instruction);

    let aiResponse: globalThis.Response;
    try {
      aiResponse = await fetch(targetUrl, {
        method: "POST",
        body: formData,
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
    console.error("Unexpected error in /api/bill/process proxy:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while processing the bill.",
      },
    });
  }
});

export default router;
