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
