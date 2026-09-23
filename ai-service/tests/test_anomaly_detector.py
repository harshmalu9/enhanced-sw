import pytest
from fastapi.testclient import TestClient
from app import app
from services.anomaly import (
    AnomalyDetectionRequest,
    ExpenseItemForAnomaly,
    get_anomaly_detector_service,
)

client = TestClient(app)


def test_anomaly_detector_empty_expenses():
    service = get_anomaly_detector_service()
    res = service.detect_anomalies(AnomalyDetectionRequest(expenses=[]))
    assert res.success is True
    assert res.total_expenses_analyzed == 0
    assert res.has_sufficient_history is False
    assert len(res.anomalies) == 0


def test_anomaly_detector_insufficient_data():
    service = get_anomaly_detector_service()
    expenses = [
        ExpenseItemForAnomaly(description="Coffee", amount=200, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Snack", amount=150, category="Food & Dining"),
    ]
    res = service.detect_anomalies(AnomalyDetectionRequest(expenses=expenses))
    assert res.success is True
    assert res.total_expenses_analyzed == 2
    assert res.has_sufficient_history is False
    assert len(res.anomalies) == 0


def test_anomaly_detector_flags_significant_outlier():
    service = get_anomaly_detector_service()
    expenses = [
        ExpenseItemForAnomaly(description="Normal Lunch 1", amount=300, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Normal Lunch 2", amount=350, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Normal Lunch 3", amount=320, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Normal Lunch 4", amount=280, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Normal Lunch 5", amount=340, category="Food & Dining"),
        ExpenseItemForAnomaly(id="outlier-1", description="Luxury Banquet Dinner", amount=9800, category="Food & Dining"),
        ExpenseItemForAnomaly(description="Metro card", amount=400, category="Transportation"),
        ExpenseItemForAnomaly(description="Uber ride", amount=350, category="Transportation"),
        ExpenseItemForAnomaly(description="Auto fare", amount=120, category="Transportation"),
    ]
    res = service.detect_anomalies(AnomalyDetectionRequest(expenses=expenses, sensitivity_factor=2.0))
    assert res.success is True
    assert res.has_sufficient_history is True
    assert res.anomalies_detected_count == 1
    flagged = res.anomalies[0]
    assert flagged.expense_id == "outlier-1"
    assert flagged.amount == 9800
    assert flagged.category == "Food & Dining"
    assert flagged.severity == "HIGH"
    assert "higher than your typical Food & Dining average" in flagged.reason


def test_api_detect_anomalies_endpoint():
    payload = {
        "expenses": [
            {"description": "Item 1", "amount": 100.0, "category": "Shopping"},
            {"description": "Item 2", "amount": 120.0, "category": "Shopping"},
            {"description": "Item 3", "amount": 110.0, "category": "Shopping"},
            {"description": "Item 4", "amount": 130.0, "category": "Shopping"},
            {"description": "Massive Luxury Purchase", "amount": 15000.0, "category": "Shopping"},
        ]
    }
    response = client.post("/api/spending/anomalies", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["anomalies_detected_count"] == 1
    assert data["anomalies"][0]["amount"] == 15000.0
