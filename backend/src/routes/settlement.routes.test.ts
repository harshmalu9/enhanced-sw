import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";

describe("Backend API: /api/settlement/simplify", () => {
  let server: http.Server;
  let baseUrl: string;
  let mockAiServer: http.Server;
  let mockAiPort: number;

  before(async () => {
    // Start mock AI microservice for settlement
    mockAiServer = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/settlement/simplify") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const parsed = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              title: parsed.title,
              total_group_spent: 1200.0,
              fair_share_per_person: 400.0,
              balances: [
                { person: "A", amount_paid: 900.0, fair_share: 400.0, net_balance: 500.0 },
                { person: "B", amount_paid: 300.0, fair_share: 400.0, net_balance: -100.0 },
                { person: "C", amount_paid: 0.0, fair_share: 400.0, net_balance: -400.0 },
              ],
              transfers: [
                { from_person: "C", to_person: "A", amount: 400.0, instruction: "C pays A ₹400.00" },
                { from_person: "B", to_person: "A", amount: 100.0, instruction: "B pays A ₹100.00" },
              ],
              total_transfers_count: 2,
              is_settled: false,
            })
          );
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      mockAiServer.listen(0, "127.0.0.1", () => {
        const addr = mockAiServer.address();
        if (typeof addr === "object" && addr !== null) {
          mockAiPort = addr.port;
          process.env.AI_SERVICE_URL = `http://127.0.0.1:${mockAiPort}`;
        }
        resolve();
      });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mockAiServer) await new Promise<void>((resolve) => mockAiServer.close(() => resolve()));
  });

  test("should forward valid settlement request and return minimal transfers", async () => {
    const payload = {
      title: "Group Dinner",
      payments: [
        { person: "A", amount_paid: 900 },
        { person: "B", amount_paid: 300 },
        { person: "C", amount_paid: 0 },
      ],
    };

    const res = await fetch(`${baseUrl}/api/settlement/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.total_group_spent, 1200);
    assert.strictEqual(body.transfers.length, 2);
  });

  test("should return 400 if participants are fewer than 2", async () => {
    const res = await fetch(`${baseUrl}/api/settlement/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payments: [{ person: "A", amount_paid: 100 }] }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test("should return 400 if amount_paid is negative", async () => {
    const res = await fetch(`${baseUrl}/api/settlement/simplify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payments: [
          { person: "A", amount_paid: -50 },
          { person: "B", amount_paid: 100 },
        ],
      }),
    });

    assert.strictEqual(res.status, 400);
  });
});
