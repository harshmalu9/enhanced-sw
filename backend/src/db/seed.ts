import { getPool, closePool, getDatabaseUrl } from "./client.js";

interface SeedExpense {
  description: string;
  amount: number;
  category: string;
  merchant?: string;
  daysAgo: number;
}

// 45+ realistic seed expenses spanning the last 60 days
const SEED_EXPENSES: SeedExpense[] = [
  // Food & Dining
  { description: "Dinner with college team at Olive Garden", amount: 1450.00, category: "Food & Dining", merchant: "Olive Garden", daysAgo: 1 },
  { description: "Starbucks Cappuccino & Croissant", amount: 380.00, category: "Food & Dining", merchant: "Starbucks", daysAgo: 2 },
  { description: "Swiggy lunch bowl", amount: 320.00, category: "Food & Dining", merchant: "Swiggy", daysAgo: 4 },
  { description: "Zomato Pizza order with roommates", amount: 890.00, category: "Food & Dining", merchant: "Zomato", daysAgo: 6 },
  { description: "Subway 6-inch Veggie Delite", amount: 260.00, category: "Food & Dining", merchant: "Subway", daysAgo: 8 },
  { description: "Cafe Coffee Day cold coffee & fries", amount: 410.00, category: "Food & Dining", merchant: "CCD", daysAgo: 11 },
  { description: "Barbeque Nation buffet with family", amount: 3200.00, category: "Food & Dining", merchant: "Barbeque Nation", daysAgo: 14 },
  { description: "Campus Canteen tea & samosas", amount: 90.00, category: "Food & Dining", merchant: "Campus Canteen", daysAgo: 16 },
  { description: "McDonalds McSpicy Meal", amount: 360.00, category: "Food & Dining", merchant: "McDonalds", daysAgo: 19 },
  { description: "Dinner at Punjab Grill", amount: 2100.00, category: "Food & Dining", merchant: "Punjab Grill", daysAgo: 24 },
  { description: "Chai Point ginger tea flask", amount: 190.00, category: "Food & Dining", merchant: "Chai Point", daysAgo: 28 },
  { description: "Luxury 5-Star Hotel Banquet Dinner", amount: 9800.00, category: "Food & Dining", merchant: "The Taj Palace", daysAgo: 32 }, // Intentional Food Anomaly

  // Groceries
  { description: "Weekly vegetables and fruits", amount: 650.00, category: "Groceries", merchant: "Nature's Basket", daysAgo: 3 },
  { description: "Blinkit milk, bread and eggs", amount: 240.00, category: "Groceries", merchant: "Blinkit", daysAgo: 7 },
  { description: "Zepto instant snack refill", amount: 310.00, category: "Groceries", merchant: "Zepto", daysAgo: 12 },
  { description: "Supermarket monthly pantry restock", amount: 2850.00, category: "Groceries", merchant: "DMart", daysAgo: 20 },
  { description: "Blinkit cooking oil & spices", amount: 490.00, category: "Groceries", merchant: "Blinkit", daysAgo: 27 },
  { description: "Zepto morning breakfast ingredients", amount: 180.00, category: "Groceries", merchant: "Zepto", daysAgo: 35 },
  { description: "Bulk organic pantry grains & dry fruits", amount: 4200.00, category: "Groceries", merchant: "Organic India", daysAgo: 45 },

  // Transportation
  { description: "Uber cab to tech campus", amount: 340.00, category: "Transportation", merchant: "Uber", daysAgo: 2 },
  { description: "Metro smart card recharge", amount: 500.00, category: "Transportation", merchant: "Metro Rail", daysAgo: 5 },
  { description: "Auto rickshaw ride to market", amount: 120.00, category: "Transportation", merchant: "Rapido Auto", daysAgo: 9 },
  { description: "Ola cab return ride late night", amount: 480.00, category: "Transportation", merchant: "Ola Cabs", daysAgo: 15 },
  { description: "Petrol refill for two-wheeler", amount: 800.00, category: "Transportation", merchant: "Indian Oil", daysAgo: 22 },
  { description: "Uber cab to airport terminal 3", amount: 1250.00, category: "Transportation", merchant: "Uber", daysAgo: 38 },

  // Shopping
  { description: "Zara linen summer shirt", amount: 2490.00, category: "Shopping", merchant: "Zara", daysAgo: 5 },
  { description: "Amazon ergonomic mouse pad & cable", amount: 499.00, category: "Shopping", merchant: "Amazon", daysAgo: 10 },
  { description: "Decathlon gym shorts & water bottle", amount: 1199.00, category: "Shopping", merchant: "Decathlon", daysAgo: 18 },
  { description: "Myntra casual running shoes", amount: 3200.00, category: "Shopping", merchant: "Myntra", daysAgo: 30 },
  { description: "High-end mechanical gaming keyboard", amount: 14500.00, category: "Shopping", merchant: "Keychron", daysAgo: 42 }, // Intentional Shopping Anomaly

  // Entertainment
  { description: "PVR Cinemas movie tickets for 2", amount: 720.00, category: "Entertainment", merchant: "PVR", daysAgo: 4 },
  { description: "Netflix 4K monthly subscription", amount: 649.00, category: "Entertainment", merchant: "Netflix", daysAgo: 13 },
  { description: "Spotify Duo premium subscription", amount: 179.00, category: "Entertainment", merchant: "Spotify", daysAgo: 17 },
  { description: "Gaming console subscription", amount: 499.00, category: "Entertainment", merchant: "Sony PSN", daysAgo: 29 },
  { description: "Standup comedy live show pass", amount: 1200.00, category: "Entertainment", merchant: "BookMyShow", daysAgo: 40 },

  // Bills & Utilities
  { description: "High-speed Fiber broadband bill", amount: 1199.00, category: "Bills & Utilities", merchant: "Airtel Xstream", daysAgo: 7 },
  { description: "Electricity monthly bill", amount: 2450.00, category: "Bills & Utilities", merchant: "State Electricity Board", daysAgo: 15 },
  { description: "Mobile postpaid family plan", amount: 999.00, category: "Bills & Utilities", merchant: "Jio Postpaid", daysAgo: 21 },
  { description: "LPG cooking gas cylinder", amount: 900.00, category: "Bills & Utilities", merchant: "HP Gas", daysAgo: 36 },

  // Healthcare
  { description: "Pharmacy vitamins & pain relief tablets", amount: 450.00, category: "Healthcare", merchant: "Apollo Pharmacy", daysAgo: 8 },
  { description: "Dental cleaning & consultation", amount: 1500.00, category: "Healthcare", merchant: "Clove Dental", daysAgo: 26 },
  { description: "Routine health checkup blood test", amount: 1800.00, category: "Healthcare", merchant: "1mg Diagnostics", daysAgo: 48 },

  // Education
  { description: "Online cloud architecture certification course", amount: 1299.00, category: "Education", merchant: "Udemy", daysAgo: 16 },
  { description: "O'Reilly technical reference book", amount: 850.00, category: "Education", merchant: "Amazon Books", daysAgo: 33 },

  // Travel
  { description: "Weekend getaway Airbnb stay", amount: 5500.00, category: "Travel", merchant: "Airbnb", daysAgo: 25 },
  { description: "Intercity train ticket roundtrip", amount: 1100.00, category: "Travel", merchant: "IRCTC", daysAgo: 26 },
];

export async function seedDemoData(options?: { clearExisting?: boolean }): Promise<{
  expensesCount: number;
  budgetsCount: number;
}> {
  const pool = getPool();
  const clearExisting = options?.clearExisting ?? true;

  console.log(`Seeding demo data into ${getDatabaseUrl()}...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (clearExisting) {
      await client.query("DELETE FROM expenses");
      await client.query("DELETE FROM budgets");
      console.log("Cleared existing expenses and budgets.");
    }

    // 1. Insert seed expenses with calculated dates
    const now = new Date();
    let expenseInsertCount = 0;

    for (const exp of SEED_EXPENSES) {
      const expDate = new Date(now.getTime() - exp.daysAgo * 24 * 60 * 60 * 1000);
      const dateStr = expDate.toISOString().split("T")[0];

      await client.query(
        `INSERT INTO expenses (description, amount, category, merchant, expense_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [exp.description, exp.amount, exp.category, exp.merchant || null, dateStr]
      );
      expenseInsertCount++;
    }

    // 2. Insert realistic budget for current and previous month
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    // Category budget breakdown
    const categoryBudgets = {
      "Food & Dining": 6000.00,
      "Groceries": 5000.00,
      "Transportation": 3000.00,
      "Shopping": 5000.00,
      "Entertainment": 2500.00,
      "Bills & Utilities": 4500.00,
      "Healthcare": 2500.00,
      "Education": 2000.00,
      "Travel": 6000.00,
    };

    await client.query(
      `INSERT INTO budgets (month_year, monthly_budget, category_budgets)
       VALUES ($1, $2, $3)
       ON CONFLICT (month_year) 
       DO UPDATE SET monthly_budget = EXCLUDED.monthly_budget,
                     category_budgets = EXCLUDED.category_budgets,
                     updated_at = NOW()`,
      [currentMonthStr, 35000.00, JSON.stringify(categoryBudgets)]
    );

    await client.query("COMMIT");
    console.log(`✓ Successfully seeded ${expenseInsertCount} expenses and budget for ${currentMonthStr}.`);

    return {
      expensesCount: expenseInsertCount,
      budgetsCount: 1,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Failed to seed demo data:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI execution: tsx src/db/seed.ts
if (process.argv[1]?.endsWith("seed.ts")) {
  seedDemoData()
    .then(async (res) => {
      console.log(`Seeding complete: ${res.expensesCount} expenses, ${res.budgetsCount} budgets.`);
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Seeding execution error:", err);
      await closePool();
      process.exit(1);
    });
}
