# Screenshot Catalog and Figure Index

This index documents all visual evidence captured autonomously from the running `enhanced-sw` application stack (Presentation Tier on Expo Web at `http://localhost:8081`, Application Gateway at `http://localhost:3001`, and Python FastAPI AI Service at `http://localhost:8000`).

| Figure # | File Path | Screen / View | Captured Capabilities & Features |
|---|---|---|---|
| **Fig. 4.1** | `report/screenshots/01_home_dashboard.png` | Home Dashboard View | Overview of total monthly spend (₹7,740 / ₹35,000 budget), active budget progress bar, recent activity stream, quick action buttons, and anomaly alerts banner. |
| **Fig. 4.2** | `report/screenshots/02_expenses_empty_or_initial.png` | Filtered Expense Ledger | Empty search state in expense ledger showing clear filters button and search input bar. |
| **Fig. 4.3** | `report/screenshots/03_expense_add_form.png` | Add Expense Form Modal | Material-style bottom sheet modal showing description, amount, optional merchant, and date selector with automatic AI categorization upon saving. |
| **Fig. 4.4** | `report/screenshots/04_expense_added.png` | Expense Ledger with Transactions | Expense ledger showing newly added transaction recorded with automatic category badge. |
| **Fig. 4.5** | `report/screenshots/05_expense_history.png` | Transaction History & Filters | Full chronological ledger with category filter pills (Food & Dining, Groceries, Transportation, etc.) and itemized transactions. |
| **Fig. 4.6** | `report/screenshots/06_split_receipt.png` | Step 1: Receipt Selection | Step 1 of Receipt Split flow showing receipt selection options (Take Photo / Choose from Gallery) prior to participant assignment. |
| **Fig. 4.7** | `report/screenshots/07_split_participants.png` | Step 2: Participant Management | Step 2 participant selection interface showing participant tags (Me, Friend) and equal split toggle. |
| **Fig. 4.8** | `report/screenshots/08_split_review.png` | Item Consumption Prompt | Step 2 of Receipt Split flow showing participant selection, equal split toggle, and natural language item consumption prompt. |
| **Fig. 4.9** | `report/screenshots/09_split_result.png` | Calculated Split Result Breakdown | Calculated split result showing the per-person breakdown, proportional tax allocation, and reconciled total. |
| **Fig. 4.10** | `report/screenshots/10_split_added_to_expenses.png` | Detailed Split Breakdown View | Detailed split summary view displaying itemized per-person shares and reconciliation status. |
| **Fig. 4.11** | `report/screenshots/11_budget.png` | Budget Tracking & Envelopes | Monthly spending limit vs. current outlay, percentage consumed, and category-level budget health indicators. |
| **Fig. 4.12** | `report/screenshots/12_anomaly_insights.png` | Statistical Anomaly Alerts | Leave-One-Out (LOO) detected outlier transactions flagged with dynamic threshold benchmarks and severity tags. |
| **Fig. 4.13** | `report/screenshots/13_spending_insights.png` | Spending Insights & Commentary | Deterministic metrics (burn rate, category breakdown, peak day) combined with LLM qualitative commentary and budget recommendations. |
| **Fig. 4.14** | `report/screenshots/14_forecast.png` | Meta Prophet Spend Projections | 30-day forward projection curve with linear trend trajectory and 80% uncertainty intervals. |
| **Fig. 4.15** | `report/screenshots/15_group_settlement.png` | Group Debt Input Configuration | Group balance configuration screen for entering participant spending amounts prior to simplification. |
| **Fig. 4.16** | `report/screenshots/16_settlement_result.png` | Settlement Plan & Transfer Tracking | Settlement plan resolving group obligations into direct cash transfers, featuring in-session Pending/Settled tracking and remaining balance overview. |
