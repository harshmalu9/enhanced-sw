import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { ExpenseService } from "./expense.service.js";
import { type ExpenseRepository, type ExpenseRecord } from "./expense.repository.js";

describe("Business Layer: ExpenseService", () => {
  let service: ExpenseService;
  let mockRepo: ExpenseRepository;
  let storedRecords: ExpenseRecord[] = [];
  let mockAiServer: http.Server;
  let mockAiPort: number;

  before(async () => {
    // Start mock AI server
    mockAiServer = http.createServer((req, res) => {
      if (req.url === "/api/expense/categorize" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          if (parsed.description.toLowerCase().includes("uber")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: { category: "Transportation", confidence: "high" },
              })
            );
          } else if (parsed.description.toLowerCase().includes("invalid")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: { category: "NonExistentCategory", confidence: "high" },
              })
            );
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: true,
                data: { category: "Food & Dining", confidence: "high" },
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
    const addr = mockAiServer.address();
    if (addr && typeof addr === "object") {
      mockAiPort = addr.port;
    }
    process.env.AI_SERVICE_URL = `http://localhost:${mockAiPort}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => mockAiServer.close(() => resolve()));
  });

  beforeEach(() => {
    storedRecords = [];
    mockRepo = {
      create: async (dto) => {
        const rec: ExpenseRecord = {
          id: `id-${storedRecords.length + 1}`,
          description: dto.description,
          amount: dto.amount,
          category: dto.category,
          merchant: dto.merchant || null,
          date: dto.date || "2026-09-20",
          created_at: "2026-09-20T10:00:00Z",
          updated_at: "2026-09-20T10:00:00Z",
        };
        storedRecords.push(rec);
        return rec;
      },
      findAll: async () => [...storedRecords],
      findById: async (id) => storedRecords.find((r) => r.id === id) || null,
      deleteById: async (id) => {
        const idx = storedRecords.findIndex((r) => r.id === id);
        if (idx >= 0) {
          storedRecords.splice(idx, 1);
          return true;
        }
        return false;
      },
    } as any;

    service = new ExpenseService(mockRepo);
  });

  it("should create an expense with explicit category without calling AI", async () => {
    const expense = await service.createExpense({
      description: "Textbook",
      amount: 600,
      category: "Education",
      merchant: "Bookstore",
    });

    assert.equal(expense.description, "Textbook");
    assert.equal(expense.amount, 600);
    assert.equal(expense.category, "Education");
    assert.equal(expense.merchant, "Bookstore");
  });

  it("should automatically categorize and save expense when category is omitted", async () => {
    const expense = await service.createExpense({
      description: "Uber ride from college to home",
      amount: 450,
      merchant: "Uber",
    });

    assert.equal(expense.description, "Uber ride from college to home");
    assert.equal(expense.amount, 450);
    assert.equal(expense.category, "Transportation");
    assert.equal(expense.merchant, "Uber");
  });

  it("should throw error if AI returns non-canonical category", async () => {
    await assert.rejects(
      () =>
        service.createExpense({
          description: "Invalid transaction description",
          amount: 100,
        }),
      /AI_INVALID_CATEGORY/
    );
  });

  it("should throw error if description is empty", async () => {
    await assert.rejects(
      () =>
        service.createExpense({
          description: "   ",
          amount: 100,
        }),
      /VALIDATION_ERROR/
    );
  });

  it("should throw error if amount is negative", async () => {
    await assert.rejects(
      () =>
        service.createExpense({
          description: "Bus fare",
          amount: -50,
        }),
      /VALIDATION_ERROR/
    );
  });

  it("should list, get, and delete expenses correctly", async () => {
    const created = await service.createExpense({
      description: "Coffee",
      amount: 150,
      category: "Food & Dining",
    });

    const list = await service.listExpenses();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);

    const found = await service.getExpenseById(created.id);
    assert.ok(found);
    assert.equal(found.description, "Coffee");

    const deleted = await service.deleteExpenseById(created.id);
    assert.equal(deleted, true);

    const listAfter = await service.listExpenses();
    assert.equal(listAfter.length, 0);
  });
});
