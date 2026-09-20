import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app import app
from services.spending.analyzer import SpendingAnalyzer
from services.spending.schemas import (
    ExpenseItem,
    PeriodInfo,
    SpendingInsightsData,
    SpendingInsightsLLMOutput,
    SpendingSummary,
)
from services.spending.service import (
    SpendingInsightsAPIError,
    SpendingInsightsConfigError,
    SpendingInsightsService,
    SpendingInsightsValidationError,
)
from services.llm.exceptions import (
    LLMAllProvidersFailedError,
    LLMConfigurationError,
)

client = TestClient(app)


# =====================================================================
# 1. Deterministic Spending Analyzer Tests (No LLM)
# =====================================================================

def test_analyzer_empty_expenses():
    """Test deterministic analysis on empty expense list."""
    summary = SpendingAnalyzer.analyze([])
    assert summary.total_spending == 0.0
    assert summary.expense_count == 0
    assert summary.average_expense == 0.0
    assert summary.spending_by_category == {}
    assert summary.category_percentages == {}
    assert summary.highest_spending_category is None
    assert summary.largest_expense is None


def test_analyzer_single_expense():
    """Test deterministic analysis on a single expense."""
    items = [
        ExpenseItem(
            description="Coffee",
            amount=150.0,
            category="Food & Dining",
            merchant="Starbucks",
            date="2026-09-20",
        )
    ]
    summary = SpendingAnalyzer.analyze(items)
    assert summary.total_spending == 150.0
    assert summary.expense_count == 1
    assert summary.average_expense == 150.0
    assert summary.spending_by_category == {"Food & Dining": 150.0}
    assert summary.category_percentages == {"Food & Dining": 100.0}
    assert summary.highest_spending_category is not None
    assert summary.highest_spending_category.category == "Food & Dining"
    assert summary.highest_spending_category.amount == 150.0
    assert summary.highest_spending_category.percentage == 100.0
    assert summary.largest_expense is not None
    assert summary.largest_expense.description == "Coffee"
    assert summary.largest_expense.amount == 150.0
    assert summary.largest_expense.merchant == "Starbucks"


def test_analyzer_multiple_expenses_and_categories():
    """Test deterministic analysis across diverse categories and amounts."""
    items = [
        ExpenseItem(description="Pizza", amount=600.0, category="Food & Dining", merchant="Dominos"),
        ExpenseItem(description="Burger", amount=400.0, category="Food & Dining", merchant="McDonalds"),
        ExpenseItem(description="Uber ride", amount=500.0, category="Transportation", merchant="Uber"),
        ExpenseItem(description="Shoes", amount=1500.0, category="Shopping", merchant="Nike"),
    ]
    summary = SpendingAnalyzer.analyze(items)
    assert summary.total_spending == 3000.0
    assert summary.expense_count == 4
    assert summary.average_expense == 750.0
    assert summary.spending_by_category == {
        "Food & Dining": 1000.0,
        "Transportation": 500.0,
        "Shopping": 1500.0,
    }
    assert summary.category_percentages == {
        "Food & Dining": 33.33,
        "Transportation": 16.67,
        "Shopping": 50.0,
    }
    assert summary.highest_spending_category is not None
    assert summary.highest_spending_category.category == "Shopping"
    assert summary.highest_spending_category.amount == 1500.0
    assert summary.highest_spending_category.percentage == 50.0
    assert summary.largest_expense is not None
    assert summary.largest_expense.description == "Shoes"
    assert summary.largest_expense.amount == 1500.0


def test_analyzer_decimal_rounding():
    """Test exact rounding behavior with 3 equal items."""
    items = [
        ExpenseItem(description="Item 1", amount=100.0, category="Food & Dining"),
        ExpenseItem(description="Item 2", amount=100.0, category="Shopping"),
        ExpenseItem(description="Item 3", amount=100.0, category="Transportation"),
    ]
    summary = SpendingAnalyzer.analyze(items)
    assert summary.total_spending == 300.0
    assert summary.average_expense == 100.0
    assert summary.category_percentages["Food & Dining"] == 33.33
    assert summary.category_percentages["Shopping"] == 33.33
    assert summary.category_percentages["Transportation"] == 33.33


def test_schema_validation_rejects_invalid_inputs():
    """Test that invalid descriptions, negative amounts, and unknown categories are rejected."""
    # Empty description
    with pytest.raises(ValueError, match="description must not be empty"):
        ExpenseItem(description="  ", amount=100.0, category="Food & Dining")

    # Negative amount
    with pytest.raises(ValueError, match="non-negative number"):
        ExpenseItem(description="Valid", amount=-10.0, category="Food & Dining")

    # Invalid category
    with pytest.raises(ValueError, match="Invalid category"):
        ExpenseItem(description="Valid", amount=100.0, category="Cryptocurrency")

    # Invalid date format
    with pytest.raises(ValueError, match="Invalid date format"):
        ExpenseItem(description="Valid", amount=100.0, category="Food & Dining", date="not-a-date")

    # Invalid period date
    with pytest.raises(ValueError, match="Invalid period date"):
        PeriodInfo(start="bad-date", end="2026-09-20")


def test_schema_allows_optional_fields():
    """Test that merchant and date can be omitted or supplied."""
    item_minimal = ExpenseItem(description="Groceries", amount=250.0, category="Groceries")
    assert item_minimal.merchant is None
    assert item_minimal.date is None

    item_full = ExpenseItem(
        description="Groceries",
        amount=250.0,
        category="Groceries",
        merchant="BigBasket",
        date="2026-09-20",
    )
    assert item_full.merchant == "BigBasket"
    assert item_full.date == "2026-09-20"


# =====================================================================
# 2. Spending Insights Service Tests (Mocked LLM)
# =====================================================================

@pytest.mark.asyncio
async def test_insights_service_empty_expenses_skips_llm():
    """Test that empty expenses list returns immediately without invoking LLM."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock()

    service = SpendingInsightsService(router=mock_router)
    result = await service.generate_insights([])

    assert result.summary.total_spending == 0.0
    assert result.insights == []
    mock_router.ainvoke_structured.assert_not_called()


@pytest.mark.asyncio
async def test_insights_service_valid_flow():
    """Test successful insight generation with mocked LLM output."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            SpendingInsightsLLMOutput(
                insights=[
                    "Shopping was your highest spending category at ₹1,500.00 (50.0%).",
                    "Your largest transaction was ₹1,500.00 for Shoes.",
                ]
            ),
            "groq",
        )
    )

    items = [
        ExpenseItem(description="Pizza", amount=500.0, category="Food & Dining"),
        ExpenseItem(description="Shoes", amount=1500.0, category="Shopping", merchant="Nike"),
    ]

    service = SpendingInsightsService(router=mock_router)
    result = await service.generate_insights(items, period=PeriodInfo(start="2026-09-01", end="2026-09-20"))

    assert result.summary.total_spending == 2000.0
    assert result.summary.expense_count == 2
    assert len(result.insights) == 2
    assert "Shopping" in result.insights[0]
    assert result.period is not None
    assert result.period.start == "2026-09-01"
    mock_router.ainvoke_structured.assert_called_once()


@pytest.mark.asyncio
async def test_insights_service_llm_config_error():
    """Test that missing LLM configuration raises SpendingInsightsConfigError."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(side_effect=LLMConfigurationError("Missing API keys"))

    items = [ExpenseItem(description="Pizza", amount=500.0, category="Food & Dining")]

    service = SpendingInsightsService(router=mock_router)
    with pytest.raises(SpendingInsightsConfigError) as exc_info:
        await service.generate_insights(items)

    assert exc_info.value.code == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_insights_service_llm_all_providers_failed():
    """Test that provider failures raise SpendingInsightsAPIError."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        side_effect=LLMAllProvidersFailedError("All providers failed", errors={"gemini": "429"})
    )

    items = [ExpenseItem(description="Pizza", amount=500.0, category="Food & Dining")]

    service = SpendingInsightsService(router=mock_router)
    with pytest.raises(SpendingInsightsAPIError) as exc_info:
        await service.generate_insights(items)

    assert exc_info.value.code == "LLM_PROVIDER_ERROR"


@pytest.mark.asyncio
async def test_insights_service_invalid_llm_output():
    """Test that invalid insight formats from LLM raise SpendingInsightsValidationError."""
    mock_router = MagicMock()
    # LLM returns an empty list
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            SpendingInsightsLLMOutput(insights=[]),
            "groq",
        )
    )

    items = [ExpenseItem(description="Pizza", amount=500.0, category="Food & Dining")]

    service = SpendingInsightsService(router=mock_router)
    with pytest.raises(SpendingInsightsValidationError):
        await service.generate_insights(items)


# =====================================================================
# 3. API Endpoint Tests: POST /api/spending/insights
# =====================================================================

def test_api_spending_insights_success():
    """Test API endpoint with mocked service."""
    mock_summary = SpendingSummary(
        total_spending=1050.0,
        expense_count=2,
        average_expense=525.0,
        spending_by_category={"Food & Dining": 600.0, "Transportation": 450.0},
        category_percentages={"Food & Dining": 57.14, "Transportation": 42.86},
        highest_spending_category=None,
        largest_expense=None,
    )
    mock_data = SpendingInsightsData(
        summary=mock_summary,
        insights=["Food & Dining accounted for 57.14% of spending."],
        period=None,
    )

    with patch(
        "services.spending.service.SpendingInsightsService.generate_insights",
        new=AsyncMock(return_value=mock_data),
    ):
        response = client.post(
            "/api/spending/insights",
            json={
                "expenses": [
                    {"description": "Pizza", "amount": 600, "category": "Food & Dining"},
                    {"description": "Uber", "amount": 450, "category": "Transportation"},
                ]
            },
        )

        assert response.status_code == 200
        res_json = response.json()
        assert res_json["success"] is True
        assert res_json["data"]["summary"]["total_spending"] == 1050.0
        assert len(res_json["data"]["insights"]) == 1


def test_api_spending_insights_empty_list():
    """Test API endpoint with empty expense list."""
    response = client.post(
        "/api/spending/insights",
        json={"expenses": []},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["summary"]["total_spending"] == 0.0
    assert res_json["data"]["insights"] == []


def test_api_spending_insights_invalid_category():
    """Test API rejects invalid category with 400."""
    response = client.post(
        "/api/spending/insights",
        json={
            "expenses": [
                {"description": "Casino", "amount": 500, "category": "Gambling"}
            ]
        },
    )
    assert response.status_code == 400
    res_json = response.json()
    assert res_json["success"] is False
