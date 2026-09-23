import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ExpenseRepository } from "./expense.repository.js";
import * as dbClient from "../db/client.js";

describe("Database Layer: ExpenseRepository", () => {
  let repo: ExpenseRepository;
  let mockRows: any[] = [];
  let lastQueryText = "";
  let lastQueryParams: any[] = [];

  beforeEach(() => {
    mockRows = [];
    lastQueryText = "";
    lastQueryParams = [];

    // Mock query method
    const mockPool = {
      query: async (text: string, params?: any[]) => {
        lastQueryText = text;
        lastQueryParams = params || [];
        return {
          rows: mockRows,
          rowCount: mockRows.length,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    } as any;

    dbClient.setPool(mockPool);
    repo = new ExpenseRepository();
  });

  it("should create an expense and return formatted record", async () => {
    mockRows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        description: "Uber ride",
        amount: "450.00",
        category: "Transportation",
        merchant: "Uber",
        expense_date: new Date("2026-09-20T00:00:00Z"),
        created_at: new Date("2026-09-20T10:00:00Z"),
        updated_at: new Date("2026-09-20T10:00:00Z"),
      },
    ];

    const record = await repo.create({
      description: "Uber ride",
      amount: 450,
      category: "Transportation",
      merchant: "Uber",
      date: "2026-09-20",
    });

    assert.ok(lastQueryText.includes("INSERT INTO expenses"));
    assert.equal(lastQueryParams[0], "Uber ride");
    assert.equal(lastQueryParams[1], 450);
    assert.equal(lastQueryParams[2], "Transportation");
    assert.equal(lastQueryParams[3], "Uber");
    assert.equal(lastQueryParams[4], "2026-09-20");

    assert.equal(record.id, "123e4567-e89b-12d3-a456-426614174000");
    assert.equal(record.amount, 450);
    assert.equal(record.category, "Transportation");
    assert.equal(record.date, "2026-09-20");
  });

  it("should list all expenses ordered by date descending", async () => {
    mockRows = [
      {
        id: "id-1",
        description: "Coffee",
        amount: 150,
        category: "Food & Dining",
        merchant: null,
        expense_date: "2026-09-20",
        created_at: "2026-09-20T10:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
      },
    ];

    const list = await repo.findAll();
    assert.ok(lastQueryText.includes("ORDER BY expense_date DESC"));
    assert.equal(list.length, 1);
    assert.equal(list[0].description, "Coffee");
    assert.equal(list[0].amount, 150);
  });

  it("should find an expense by ID", async () => {
    mockRows = [
      {
        id: "id-target",
        description: "Dinner",
        amount: 800,
        category: "Food & Dining",
        merchant: "Restaurant",
        expense_date: "2026-09-19",
        created_at: "2026-09-19T10:00:00Z",
        updated_at: "2026-09-19T10:00:00Z",
      },
    ];

    const result = await repo.findById("id-target");
    assert.ok(lastQueryText.includes("WHERE id = $1"));
    assert.equal(lastQueryParams[0], "id-target");
    assert.ok(result);
    assert.equal(result.id, "id-target");
    assert.equal(result.description, "Dinner");
  });

  it("should return null when finding an expense that does not exist", async () => {
    mockRows = [];
    const result = await repo.findById("non-existent-id");
    assert.equal(result, null);
  });

  it("should delete an expense by ID and return true if found", async () => {
    mockRows = [{ id: "id-1" }];
    const deleted = await repo.deleteById("id-1");
    assert.ok(lastQueryText.includes("DELETE FROM expenses"));
    assert.equal(lastQueryParams[0], "id-1");
    assert.equal(deleted, true);
  });

  it("should return false when deleting an expense that does not exist", async () => {
    mockRows = [];
    const deleted = await repo.deleteById("missing-id");
    assert.equal(deleted, false);
  });
});
