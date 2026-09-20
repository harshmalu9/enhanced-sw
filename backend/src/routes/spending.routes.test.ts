import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";

describe("Backend API: /api/spending/insights", () => {
  let server: http.Server;
  let port: number;
  let mockAiServer: http.Server;
  let mockAiPort: number;

  before(async () => {
    // Start backend server
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addr = server.address();
    if (addr && typeof addr === "object") {
      port = addr.port;
    }

    // Start mock AI service
    mockAiServer = http.createServer((req, res) => {
      if (req.url === "/api/spending/insights" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          if (parsed.expenses && parsed.expenses.length === 0) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: {
                  summary: {
                    total_spending: 0,
                    expense_count: 0,
                    average_expense: 0,
                    spending_by_category: {},
                    category_percentages: {},
                    highest_spending_category: null,
                    largest_expense: null,
                  },
                  insights: [],
                  period: null,
                },
              })
            );
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: {
                  summary: {
                    total_spending: 1050,
                    expense_count: 2,
                    average_expense: 525,
                    spending_by_category: {
                      "Food & Dining": 600,
                      Transportation: 450,
                    },
                    category_percentages: {
                      "Food & Dining": 57.14,
                      Transportation: 42.86,
                    },
                    highest_spending_category: {
                      category: "Food & Dining",
                      amount: 600,
                      percentage: 57.14,
                    },
                    largest_expense: {
                      description: "Pizza",
                      amount: 600,
                      category: "Food & Dining",
                    },
                  },
                  insights: ["Food & Dining was your highest spending category."],
                  period: null,
                },
              })
            );
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    mockAiServer.listen(0);
    await new Promise<void>((resolve) => mockAiServer.once("listening", resolve));
    const aiAddr = mockAiServer.address();
    if (aiAddr && typeof aiAddr === "object") {
      mockAiPort = aiAddr.port;
    }

    process.env.AI_SERVICE_URL = `http://localhost:${mockAiPort}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => mockAiServer.close(() => resolve()));
  });

  it("should forward valid spending request and return insights", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [
          { description: "Pizza", amount: 600, category: "Food & Dining" },
          { description: "Uber", amount: 450, category: "Transportation" },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: { summary: { total_spending: number }; insights: string[] } };
    assert.equal(data.success, true);
    assert.equal(data.data.summary.total_spending, 1050);
    assert.equal(data.data.insights.length, 1);
  });

  it("should handle empty expenses array gracefully", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [],
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: { summary: { total_spending: number }; insights: string[] } };
    assert.equal(data.success, true);
    assert.equal(data.data.summary.total_spending, 0);
    assert.equal(data.data.insights.length, 0);
  });

  it("should return 400 if expenses is missing or not an array", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: "not-an-array",
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "INVALID_EXPENSES");
  });

  it("should return 400 if an expense item has empty description", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [{ description: "   ", amount: 100, category: "Food & Dining" }],
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "MISSING_DESCRIPTION");
  });

  it("should return 400 if an expense item has negative amount", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [{ description: "Coffee", amount: -50, category: "Food & Dining" }],
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "INVALID_AMOUNT");
  });

  it("should return 400 if an expense item is missing category", async () => {
    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [{ description: "Coffee", amount: 150, category: "" }],
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "MISSING_CATEGORY");
  });

  it("should return 503 if Python AI service is unreachable", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:59997";

    const res = await fetch(`http://localhost:${port}/api/spending/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenses: [{ description: "Bus fare", amount: 50, category: "Transportation" }],
      }),
    });

    assert.equal(res.status, 503);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "AI_SERVICE_UNAVAILABLE");
  });
});
