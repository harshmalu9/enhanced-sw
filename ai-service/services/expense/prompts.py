from langchain_core.prompts import ChatPromptTemplate
from services.expense.schemas import EXPENSE_CATEGORIES

EXPENSE_CATEGORIZATION_SYSTEM_PROMPT = f"""You are an expense classification assistant.
Your task is to classify an expense into EXACTLY ONE canonical category with a confidence level.

Allowed Categories:
{chr(10).join(f"- {cat}" for cat in EXPENSE_CATEGORIES)}

Confidence Levels:
- high: The description clearly and unambiguously corresponds to the category.
- medium: The description likely belongs to this category, but some ambiguity exists.
- low: The category is a guess or the description is vague/unclear.

Rules:
1. You MUST choose exactly one category from the Allowed Categories list. Do NOT invent new categories.
2. If the expense is genuinely unclear or does not fit any specific category, choose "Other" or the closest category with "low" confidence.
3. Do NOT provide explanations, reasoning, commentary, or extra text. Return ONLY the structured output.
"""

def get_expense_categorization_prompt() -> ChatPromptTemplate:
    """Return the ChatPromptTemplate for expense categorization."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", EXPENSE_CATEGORIZATION_SYSTEM_PROMPT),
            (
                "human",
                "Expense Details:\n"
                "Description: {description}\n"
                "Amount: {amount}\n"
                "Merchant: {merchant}\n\n"
                "Classify this expense into one of the allowed categories.",
            ),
        ]
    )
