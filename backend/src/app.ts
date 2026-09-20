import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import billRoutes from "./routes/bill.routes.js";
import expenseRoutes from "./routes/expense.routes.js";

const app: Application = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
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

app.use("/api/bill", billRoutes);
app.use("/api/expenses", expenseRoutes);

export default app;
