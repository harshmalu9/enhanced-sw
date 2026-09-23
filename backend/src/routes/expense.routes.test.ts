import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";

describe("Backend API: /api/expenses/categorize", () => {
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
      if (req.url === "/api/expense/categorize" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          if (parsed.description.includes("Uber")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: {
                  category: "Transportation",
                  confidence: "high",
                },
              })
            );
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: {
                  category: "Food & Dining",
                  confidence: "high",
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

  it("should forward valid categorization request and return result", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Uber ride to airport",
        amount: 500,
        merchant: "Uber",
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: { category: string; confidence: string } };
    assert.equal(data.success, true);
    assert.equal(data.data.category, "Transportation");
    assert.equal(data.data.confidence, "high");
  });

  it("should return 400 if description is missing or empty", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "   ",
        amount: 100,
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "MISSING_DESCRIPTION");
  });

  it("should return 400 if amount is negative", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Coffee",
        amount: -50,
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "INVALID_AMOUNT");
  });

  it("should return 400 if merchant is not a string", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Coffee",
        merchant: 12345,
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { success: boolean; error: { code: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "INVALID_MERCHANT");
  });

  it("should return 503 if Python AI service is unreachable", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:59998";

    const res = await fetch(`http://localhost:${port}/api/expenses/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Bus fare",
      }),
    });

    assert.equal(res.status, 503);
    const data = (await res.json()) as { success: boolean; error: { code: string; message: string } };
    assert.equal(data.success, false);
    assert.equal(data.error.code, "AI_SERVICE_UNAVAILABLE");
  });
});

describe("Backend API: /api/expenses CRUD", () => {
  let server: http.Server;
  let port: number;
  let mockAiServer: http.Server;
  let mockAiPort: number;
  let mockDbRows: any[] = [];

  before(async () => {
    const dbClient = await import("../db/client.js");
    dbClient.setPool({
      query: async (text: string, params?: any[]) => {
        if (text.includes("INSERT INTO expenses")) {
          const row = {
            id: "uuid-new-123",
            description: params?.[0],
            amount: String(params?.[1]),
            category: params?.[2],
            merchant: params?.[3],
            expense_date: params?.[4] || new Date().toISOString().split("T")[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return { rows: [row], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
        }
        if (text.includes("SELECT") && text.includes("WHERE id = $1")) {
          const id = params?.[0];
          const found = mockDbRows.filter((r) => r.id === id);
          return { rows: found, rowCount: found.length, command: "SELECT", oid: 0, fields: [] };
        }
        if (text.includes("SELECT") && text.includes("FROM expenses")) {
          return { rows: mockDbRows, rowCount: mockDbRows.length, command: "SELECT", oid: 0, fields: [] };
        }
        if (text.includes("DELETE FROM expenses")) {
          const id = params?.[0];
          const idx = mockDbRows.findIndex((r) => r.id === id);
          if (idx !== -1) {
            mockDbRows.splice(idx, 1);
            return { rows: [{ id }], rowCount: 1, command: "DELETE", oid: 0, fields: [] };
          }
          return { rows: [], rowCount: 0, command: "DELETE", oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: "UNKNOWN", oid: 0, fields: [] };
      },
    } as any);

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addr = server.address();
    if (addr && typeof addr === "object") {
      port = addr.port;
    }

    mockAiServer = http.createServer((req, res) => {
      if (req.url === "/api/expense/categorize" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            data: {
              category: "Food & Dining",
              confidence: "high",
            },
          })
        );
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

  it("should create an expense with explicit category", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Gas station",
        amount: 80,
        category: "Transportation",
        merchant: "Shell",
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as { success: boolean; data: any };
    assert.equal(data.success, true);
    assert.equal(data.data.id, "uuid-new-123");
    assert.equal(data.data.description, "Gas station");
    assert.equal(data.data.amount, 80);
    assert.equal(data.data.category, "Transportation");
  });

  it("should create an expense with automatic categorization when category is omitted", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Lunch at Subway",
        amount: 120,
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as { success: boolean; data: any };
    assert.equal(data.success, true);
    assert.equal(data.data.description, "Lunch at Subway");
    assert.equal(data.data.category, "Food & Dining");
  });

  it("should list all expenses", async () => {
    mockDbRows = [
      {
        id: "exp-1",
        description: "Coffee",
        amount: "5.50",
        category: "Food & Dining",
        merchant: "Starbucks",
        expense_date: "2026-09-20",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const res = await fetch(`http://localhost:${port}/api/expenses`, {
      method: "GET",
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: any[] };
    assert.equal(data.success, true);
    assert.equal(data.data.length, 1);
    assert.equal(data.data[0].id, "exp-1");
    assert.equal(data.data[0].amount, 5.5);
  });

  it("should get expense by ID", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/exp-1`, {
      method: "GET",
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: any };
    assert.equal(data.success, true);
    assert.equal(data.data.id, "exp-1");
  });

  it("should return 404 when getting non-existent expense", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/non-existent`, {
      method: "GET",
    });

    assert.equal(res.status, 404);
  });

  it("should delete expense by ID", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/exp-1`, {
      method: "DELETE",
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { success: boolean; data: any };
    assert.equal(data.success, true);
    assert.equal(data.data.deleted, true);
  });

  it("should return 404 when deleting non-existent expense", async () => {
    const res = await fetch(`http://localhost:${port}/api/expenses/non-existent`, {
      method: "DELETE",
    });

    assert.equal(res.status, 404);
  });
});
