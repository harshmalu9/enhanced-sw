import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import billRoutes from "./routes/bill.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import spendingRoutes from "./routes/spending.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import settlementRoutes from "./routes/settlement.routes.js";
import devRoutes from "./routes/dev.routes.js";

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
app.use("/api/spending", spendingRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/settlement", settlementRoutes);
app.use("/api/dev", devRoutes);

export default app;
