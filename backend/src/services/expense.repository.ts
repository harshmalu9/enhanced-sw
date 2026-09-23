import { query } from "../db/client.js";

export interface ExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category: string;
  merchant: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseDTO {
  description: string;
  amount: number;
  category: string;
  merchant?: string | null;
  date?: string | null;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount: string | number;
  category: string;
  merchant: string | null;
  expense_date: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

function formatDateOnly(d: Date | string): string {
  if (d instanceof Date) {
    return d.toISOString().split("T")[0];
  }
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return String(d);
}

function mapRowToRecord(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    description: row.description,
    amount: typeof row.amount === "number" ? row.amount : parseFloat(row.amount),
    category: row.category,
    merchant: row.merchant || null,
    date: formatDateOnly(row.expense_date),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export class ExpenseRepository {
  async create(dto: CreateExpenseDTO): Promise<ExpenseRecord> {
    const text = `
      INSERT INTO expenses (description, amount, category, merchant, expense_date)
      VALUES ($1, $2, $3, $4, COALESCE($5::DATE, CURRENT_DATE))
      RETURNING id, description, amount, category, merchant, expense_date, created_at, updated_at
    `;
    const params = [
      dto.description.trim(),
      dto.amount,
      dto.category.trim(),
      dto.merchant ? dto.merchant.trim() : null,
      dto.date ? dto.date.trim() : null,
    ];

    const result = await query<ExpenseRow>(text, params);
    return mapRowToRecord(result.rows[0]);
  }

  async findAll(): Promise<ExpenseRecord[]> {
    const text = `
      SELECT id, description, amount, category, merchant, expense_date, created_at, updated_at
      FROM expenses
      ORDER BY expense_date DESC, created_at DESC
    `;
    const result = await query<ExpenseRow>(text);
    return result.rows.map(mapRowToRecord);
  }

  async findById(id: string): Promise<ExpenseRecord | null> {
    const text = `
      SELECT id, description, amount, category, merchant, expense_date, created_at, updated_at
      FROM expenses
      WHERE id = $1
    `;
    const result = await query<ExpenseRow>(text, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapRowToRecord(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const text = `
      DELETE FROM expenses
      WHERE id = $1
    `;
    const result = await query(text, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const expenseRepository = new ExpenseRepository();
export function getExpenseRepository(): ExpenseRepository {
  return expenseRepository;
}
