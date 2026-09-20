from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Canonical Category Definitions
EXPENSE_CATEGORIES: List[str] = [
    "Food & Dining",
    "Transportation",
    "Shopping",
    "Entertainment",
    "Bills & Utilities",
    "Healthcare",
    "Education",
    "Travel",
    "Groceries",
    "Personal Care",
    "Other",
]

EXPENSE_CATEGORIES_SET = set(EXPENSE_CATEGORIES)
VALID_CONFIDENCE_LEVELS = {"high", "medium", "low"}


class ExpenseCategorizeRequest(BaseModel):
    """Request payload for expense categorization."""
    description: str = Field(..., description="Expense description text")
    amount: Optional[float] = Field(None, description="Optional monetary amount")
    merchant: Optional[str] = Field(None, description="Optional merchant name")

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Expense description must not be empty or whitespace only.")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Expense amount must be a non-negative number.")
        return v

    @field_validator("merchant")
    @classmethod
    def validate_merchant(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return None


class ExpenseCategoryLLMOutput(BaseModel):
    """Structured output expected from LangChain LLM."""
    category: str = Field(
        ...,
        description=(
            "Exact category matching one of: Food & Dining, Transportation, Shopping, "
            "Entertainment, Bills & Utilities, Healthcare, Education, Travel, "
            "Groceries, Personal Care, Other."
        ),
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ...,
        description="Classification confidence level: 'high', 'medium', or 'low'.",
    )


class ExpenseCategorizationData(BaseModel):
    """Normalized and validated expense categorization result."""
    category: str
    confidence: str


class ExpenseCategorizeResponse(BaseModel):
    """API response for expense categorization."""
    success: bool
    data: ExpenseCategorizationData
