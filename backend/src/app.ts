import express, { type Application, type Request, type Response } from "express";
import cors from "cors";

const app: Application = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "enhanced-sw-backend",
  });
});

export default app;
