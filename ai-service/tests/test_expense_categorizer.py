import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app import app
from services.expense.categorizer import (
    ExpenseCategorizationAPIError,
    ExpenseCategorizationConfigError,
    ExpenseCategorizationValidationError,
    ExpenseCategorizerService,
)
from services.expense.schemas import (
    EXPENSE_CATEGORIES,
    ExpenseCategorizationData,
    ExpenseCategoryLLMOutput,
)
from services.llm.exceptions import (
    LLMAllProvidersFailedError,
    LLMConfigurationError,
    LLMProviderError,
)

client = TestClient(app)


# =====================================================================
# Unit Tests for ExpenseCategorizerService
# =====================================================================

@pytest.mark.asyncio
async def test_categorize_transportation_valid():
    """Test standard valid classification for transportation."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            ExpenseCategoryLLMOutput(category="Transportation", confidence="high"),
            "gemini",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)
    result = await service.categorize_expense(
        description="Uber ride from college to home",
        amount=450.0,
        merchant="Uber",
    )

    assert isinstance(result, ExpenseCategorizationData)
    assert result.category == "Transportation"
    assert result.confidence == "high"
    mock_router.ainvoke_structured.assert_called_once()


@pytest.mark.asyncio
async def test_categorize_food_valid():
    """Test valid classification for food & dining."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            ExpenseCategoryLLMOutput(category="Food & Dining", confidence="high"),
            "gemini",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)
    result = await service.categorize_expense(description="Pizza and Coke")

    assert result.category == "Food & Dining"
    assert result.confidence == "high"


@pytest.mark.asyncio
async def test_categorize_shopping_valid():
    """Test valid classification for shopping."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            ExpenseCategoryLLMOutput(category="Shopping", confidence="high"),
            "mistral",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)
    result = await service.categorize_expense(
        description="Bought a new T-shirt",
        amount=999.0,
    )

    assert result.category == "Shopping"
    assert result.confidence == "high"


@pytest.mark.asyncio
async def test_categorize_empty_description_rejected():
    """Test that empty or whitespace-only description raises ValueError."""
    service = ExpenseCategorizerService(router=MagicMock())

    with pytest.raises(ValueError, match="description must not be empty"):
        await service.categorize_expense(description="")

    with pytest.raises(ValueError, match="description must not be empty"):
        await service.categorize_expense(description="   ")


@pytest.mark.asyncio
async def test_categorize_negative_amount_rejected():
    """Test that negative amount raises ValueError."""
    service = ExpenseCategorizerService(router=MagicMock())

    with pytest.raises(ValueError, match="non-negative number"):
        await service.categorize_expense(
            description="Taxi fare",
            amount=-50.0,
        )


@pytest.mark.asyncio
async def test_categorize_invalid_category_from_llm_rejected():
    """Test that invalid/hallucinated category returned by mocked LLM is rejected."""
    mock_router = MagicMock()
    # LLM returns a category not in canonical set
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            {"category": "Crypto & Stocks", "confidence": "high"},
            "gemini",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)

    with pytest.raises(ExpenseCategorizationValidationError) as exc_info:
        await service.categorize_expense(description="Bought Bitcoin")

    assert "Invalid category" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_CATEGORIZATION"


@pytest.mark.asyncio
async def test_categorize_invalid_confidence_from_llm_rejected():
    """Test that invalid confidence level returned by mocked LLM is rejected."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            {"category": "Transportation", "confidence": "super-confident"},
            "gemini",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)

    with pytest.raises(ExpenseCategorizationValidationError) as exc_info:
        await service.categorize_expense(description="Metro ticket")

    assert "Invalid confidence" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_CATEGORIZATION"


@pytest.mark.asyncio
async def test_categorize_with_and_without_optional_fields():
    """Test that categorizer works seamlessly with and without optional amount/merchant."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        return_value=(
            ExpenseCategoryLLMOutput(category="Groceries", confidence="medium"),
            "groq",
        )
    )

    service = ExpenseCategorizerService(router=mock_router)

    # 1. Without optional fields
    res1 = await service.categorize_expense(description="Bought milk and bread")
    assert res1.category == "Groceries"
    assert res1.confidence == "medium"

    # 2. With only amount
    res2 = await service.categorize_expense(description="Bought milk and bread", amount=120.0)
    assert res2.category == "Groceries"

    # 3. With both amount and merchant
    res3 = await service.categorize_expense(
        description="Bought milk and bread",
        amount=120.0,
        merchant="Supermart",
    )
    assert res3.category == "Groceries"


@pytest.mark.asyncio
async def test_categorize_llm_configuration_error():
    """Test handling when no LLM providers are configured."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        side_effect=LLMConfigurationError("No LLM providers configured.")
    )

    service = ExpenseCategorizerService(router=mock_router)

    with pytest.raises(ExpenseCategorizationConfigError) as exc_info:
        await service.categorize_expense(description="Electricity bill")

    assert exc_info.value.code == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_categorize_llm_all_providers_failed():
    """Test safe application error when all LLM providers fail."""
    mock_router = MagicMock()
    mock_router.ainvoke_structured = AsyncMock(
        side_effect=LLMAllProvidersFailedError("All providers failed", errors={"gemini": "500", "mistral": "429"})
    )

    service = ExpenseCategorizerService(router=mock_router)

    with pytest.raises(ExpenseCategorizationAPIError) as exc_info:
        await service.categorize_expense(description="Netflix subscription")

    assert exc_info.value.code == "LLM_PROVIDER_ERROR"


# =====================================================================
# API Endpoint Tests: POST /api/expense/categorize
# =====================================================================

def test_api_categorize_success():
    """Test successful API categorization response structure."""
    with patch(
        "services.expense.categorizer.ExpenseCategorizerService.categorize_expense",
        new=AsyncMock(return_value=ExpenseCategorizationData(category="Transportation", confidence="high")),
    ):
        response = client.post(
            "/api/expense/categorize",
            json={
                "description": "Uber ride from college to home",
                "amount": 450,
                "merchant": "Uber",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["category"] == "Transportation"
        assert data["data"]["confidence"] == "high"


def test_api_categorize_empty_description():
    """Test API rejects empty description with 400."""
    response = client.post(
        "/api/expense/categorize",
        json={"description": "   "},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False


def test_api_categorize_negative_amount():
    """Test API rejects negative amount with 400."""
    response = client.post(
        "/api/expense/categorize",
        json={"description": "Bus ticket", "amount": -10},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False


def test_api_categorize_provider_error():
    """Test API returns 502 when LLM providers fail."""
    with patch(
        "services.expense.categorizer.ExpenseCategorizerService.categorize_expense",
        side_effect=ExpenseCategorizationAPIError("Provider error"),
    ):
        response = client.post(
            "/api/expense/categorize",
            json={"description": "Flight to Delhi"},
        )
        assert response.status_code == 502
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "LLM_PROVIDER_ERROR"


def test_api_categorize_config_error():
    """Test API returns 503 when API key is missing."""
    with patch(
        "services.expense.categorizer.ExpenseCategorizerService.categorize_expense",
        side_effect=ExpenseCategorizationConfigError("API key missing"),
    ):
        response = client.post(
            "/api/expense/categorize",
            json={"description": "Electricity bill"},
        )
        assert response.status_code == 503
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "MISSING_API_KEY"


# =====================================================================
# Optional Live Tests (Only if RUN_LIVE_TESTS=true)
# =====================================================================

RUN_LIVE = os.getenv("RUN_LIVE_TESTS", "").lower() in ("true", "1")


@pytest.mark.skipif(not RUN_LIVE, reason="Live LLM tests disabled. Set RUN_LIVE_TESTS=true to run.")
@pytest.mark.asyncio
async def test_live_expense_categorization():
    """Minimal live test executing 3 diverse real expense classifications."""
    service = ExpenseCategorizerService()

    # 1. Transportation
    res1 = await service.categorize_expense("Uber ride from college to home", 450, "Uber")
    assert res1.category == "Transportation"

    # 2. Food & Dining
    res2 = await service.categorize_expense("Pizza and Coke with friends", 600, "Domino's")
    assert res2.category == "Food & Dining"

    # 3. Shopping
    res3 = await service.categorize_expense("Bought a new pair of shoes", 2500, "Nike")
    assert res3.category == "Shopping"
