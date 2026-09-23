import pytest
from fastapi.testclient import TestClient
from app import app
from services.forecast import (
    ExpenseItemForForecast,
    SpendingForecastRequest,
    get_spending_forecaster_service,
)

client = TestClient(app)


def test_forecast_empty_data():
    service = get_spending_forecaster_service()
    res = service.forecast_spending(SpendingForecastRequest(expenses=[]))
    assert res.success is True
    assert res.has_sufficient_data is False
    assert len(res.forecast_points) == 0


def test_forecast_insufficient_data():
    service = get_spending_forecaster_service()
    expenses = [
        ExpenseItemForForecast(description="Tea", amount=50, category="Food & Dining", expense_date="2026-09-01"),
        ExpenseItemForForecast(description="Coffee", amount=150, category="Food & Dining", expense_date="2026-09-02"),
    ]
    res = service.forecast_spending(SpendingForecastRequest(expenses=expenses))
    assert res.success is True
    assert res.has_sufficient_data is False
    assert "Insufficient historical data" in res.forecast_explanation


def test_forecast_with_prophet_model():
    service = get_spending_forecaster_service()
    expenses = [
        ExpenseItemForForecast(description="Groceries", amount=500, category="Groceries", expense_date="2026-09-01"),
        ExpenseItemForForecast(description="Lunch", amount=300, category="Food & Dining", expense_date="2026-09-03"),
        ExpenseItemForForecast(description="Cab", amount=250, category="Transportation", expense_date="2026-09-05"),
        ExpenseItemForForecast(description="Dinner", amount=600, category="Food & Dining", expense_date="2026-09-08"),
        ExpenseItemForForecast(description="Pantry", amount=800, category="Groceries", expense_date="2026-09-12"),
        ExpenseItemForForecast(description="Utilities", amount=1200, category="Bills & Utilities", expense_date="2026-09-15"),
        ExpenseItemForForecast(description="Movie", amount=400, category="Entertainment", expense_date="2026-09-18"),
    ]
    res = service.forecast_spending(SpendingForecastRequest(expenses=expenses, horizon_days=7))
    assert res.success is True
    assert res.has_sufficient_data is True
    assert res.model_name == "Prophet"
    assert len(res.forecast_points) == 7
    assert res.historical_daily_average > 0
    assert res.projected_daily_average > 0
    assert res.projected_horizon_total > 0
    assert res.projected_30_day_total > 0
    assert len(res.category_forecasts) > 0

    # Verify first forecast point properties
    pt0 = res.forecast_points[0]
    assert pt0.predicted_amount >= 0
    assert pt0.lower_bound <= pt0.predicted_amount <= pt0.upper_bound
    assert "Prophet time-series model" in res.forecast_explanation


def test_api_forecast_endpoint():
    payload = {
        "expenses": [
            {"description": "E1", "amount": 100, "category": "Food & Dining", "expense_date": "2026-09-01"},
            {"description": "E2", "amount": 200, "category": "Food & Dining", "expense_date": "2026-09-03"},
            {"description": "E3", "amount": 150, "category": "Food & Dining", "expense_date": "2026-09-05"},
            {"description": "E4", "amount": 300, "category": "Food & Dining", "expense_date": "2026-09-07"},
            {"description": "E5", "amount": 250, "category": "Food & Dining", "expense_date": "2026-09-09"},
        ],
        "horizon_days": 10,
    }
    response = client.post("/api/spending/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["has_sufficient_data"] is True
    assert data["model_name"] == "Prophet"
    assert len(data["forecast_points"]) == 10
