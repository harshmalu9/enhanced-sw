from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from services.expense.schemas import EXPENSE_CATEGORIES, EXPENSE_CATEGORIES_SET


class ExpenseItem(BaseModel):
    """Input model for an individual expense item."""
    description: str = Field(..., description="Expense description")
    amount: float = Field(..., description="Expense monetary amount")
    category: str = Field(..., description="Canonical category of the expense")
    merchant: Optional[str] = Field(None, description="Optional merchant/vendor name")
    date: Optional[str] = Field(None, description="Optional ISO date string (YYYY-MM-DD)")

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Expense description must not be empty or whitespace only.")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v is None or not isinstance(v, (int, float)) or v < 0:
            raise ValueError("Expense amount must be a non-negative number.")
        return float(v)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Expense category is required.")
        v_clean = v.strip()
        for canonical in EXPENSE_CATEGORIES:
            if v_clean.lower() == canonical.lower():
                return canonical
        raise ValueError(
            f"Invalid category '{v_clean}'. Must be one of: {', '.join(EXPENSE_CATEGORIES)}"
        )

    @field_validator("merchant")
    @classmethod
    def validate_merchant(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_clean = v.strip()
            return v_clean if v_clean else None
        return None

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v_clean = v.strip()
            try:
                date.fromisoformat(v_clean)
                return v_clean
            except ValueError:
                raise ValueError(f"Invalid date format '{v_clean}'. Expected ISO format (YYYY-MM-DD).")
        return None


class PeriodInfo(BaseModel):
    """Metadata representing the time period for the expense dataset."""
    start: Optional[str] = Field(None, description="Period start date (YYYY-MM-DD)")
    end: Optional[str] = Field(None, description="Period end date (YYYY-MM-DD)")

    @field_validator("start", "end")
    @classmethod
    def validate_period_dates(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            v_clean = v.strip()
            try:
                date.fromisoformat(v_clean)
                return v_clean
            except ValueError:
                raise ValueError(f"Invalid period date format '{v_clean}'. Expected ISO format (YYYY-MM-DD).")
        return None


class HighestCategoryInfo(BaseModel):
    """Details of the category with the highest total expenditure."""
    category: str
    amount: float
    percentage: float


class LargestExpenseInfo(BaseModel):
    """Details of the single highest individual transaction."""
    description: str
    amount: float
    category: str
    merchant: Optional[str] = None


class SpendingSummary(BaseModel):
    """Deterministic mathematical analysis of expenses."""
    total_spending: float
    expense_count: int
    average_expense: float
    spending_by_category: Dict[str, float]
    category_percentages: Dict[str, float]
    highest_spending_category: Optional[HighestCategoryInfo] = None
    largest_expense: Optional[LargestExpenseInfo] = None


class SpendingInsightsLLMOutput(BaseModel):
    """Structured output schema expected from LLM."""
    insights: List[str] = Field(
        ...,
        description="List of 2 to 4 concise natural-language insights grounded strictly in the provided summary statistics.",
    )


class SpendingInsightsData(BaseModel):
    """Combined deterministic summary and AI-generated insights."""
    summary: SpendingSummary
    insights: List[str]
    period: Optional[PeriodInfo] = None


class SpendingInsightsRequest(BaseModel):
    """API request payload for spending insights."""
    expenses: List[ExpenseItem] = Field(..., description="List of expense items")
    period: Optional[PeriodInfo] = Field(None, description="Optional period metadata")


class SpendingInsightsResponse(BaseModel):
    """API response payload for spending insights."""
    success: bool
    data: SpendingInsightsData
