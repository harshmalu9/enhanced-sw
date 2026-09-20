from langchain_core.prompts import ChatPromptTemplate

SPENDING_INSIGHTS_SYSTEM_PROMPT = """You are a concise personal finance analysis assistant.
Your task is to review verified spending statistics and generate 2 to 4 clear, factual observations/insights.

Strict Constraints:
1. Grounding: Every insight must be strictly derived from the provided summary statistics (totals, category totals, percentages, top categories, largest expenses).
2. No Arithmetic: Do NOT calculate or recalculate numbers. Use the exact numbers and percentages provided in the summary.
3. No Hallucination: Do NOT invent transactions, merchants, categories, or numbers not present in the input.
4. No Financial Advice: Do NOT give financial advice, budgetary judgments, or tell the user what they "should", "ought to", or "must" spend or save.
5. Tone: Factual, neutral, and concise.
6. Return between 2 and 4 natural-language bullet points in the structured output.
"""


def get_spending_insights_prompt() -> ChatPromptTemplate:
    """Return the ChatPromptTemplate for LLM spending insight generation."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", SPENDING_INSIGHTS_SYSTEM_PROMPT),
            (
                "human",
                "Here are the verified spending summary statistics:\n"
                "Total Spending: ₹{total_spending}\n"
                "Transaction Count: {expense_count}\n"
                "Average Expense: ₹{average_expense}\n"
                "Spending by Category: {spending_by_category}\n"
                "Category Percentages: {category_percentages}\n"
                "Highest Spending Category: {highest_spending_category}\n"
                "Largest Single Expense: {largest_expense}\n"
                "Period: {period}\n\n"
                "Generate 2 to 4 concise, factual insights based solely on these statistics.",
            ),
        ]
    )
