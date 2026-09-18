from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from app import app
from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill, BillItem
from services.bill_assignment import (
    BillAssignmentAmbiguityError,
    BillAssignmentAPIError,
    BillAssignmentConfigError,
    BillAssignmentValidationError,
)
from services.bill_parser import (
    BillParserAPIError,
    BillParserConfigError,
    BillParserValidationError,
)

client = TestClient(app)


@pytest.fixture
def sample_bill_payload():
    return {
        "merchant": "Domino's Pizza",
        "items": [
            {
                "name": "Margherita Pizza",
                "quantity": 1,
                "unit_price": 299.0,
                "total_price": 299.0,
            },
            {
                "name": "Farmhouse Pizza",
                "quantity": 1,
                "unit_price": 399.0,
                "total_price": 399.0,
            },
            {
                "name": "Coke",
                "quantity": 1,
                "unit_price": 80.0,
                "total_price": 80.0,
            },
        ],
        "subtotal": 778.0,
        "tax": 3.0,
        "discount": None,
        "total": 817.0,
        "currency": "INR",
        "confidence": "high",
    }


# ==========================================
# /api/bill/parse Tests
# ==========================================


def test_api_bill_parse_success():
    expected_bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, unit_price=299.0, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, unit_price=399.0, total_price=399.0),
            BillItem(name="Coke", quantity=1, unit_price=80.0, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        discount=None,
        total=817.0,
        currency="INR",
        confidence="high",
    )

    with patch("app.get_bill_parser_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.parse_bill = AsyncMock(return_value=expected_bill)

        response = client.post(
            "/api/bill/parse",
            json={
                "text": "DOMINOSPIZZAE\nMargherita Pizza 299\nFarmhouse Pizza 399\nCoke\n80\nSubtotal\n778\nGST\n3\nTotal\n817"
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["merchant"] == "Domino's Pizza"
        assert len(data["data"]["items"]) == 3
        assert data["data"]["total"] == 817.0
        assert "validation" in data
        assert data["validation"]["is_consistent"] is False
        assert data["validation"]["difference"] == 36.0



def test_api_bill_parse_empty_text_returns_400():
    response = client.post(
        "/api/bill/parse",
        json={"text": "   "},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "EMPTY_TEXT"


def test_api_bill_parse_missing_api_key_returns_503():
    with patch("app.get_bill_parser_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.parse_bill = AsyncMock(
            side_effect=BillParserConfigError("Google Gemini API key is not configured on the server.")
        )

        response = client.post(
            "/api/bill/parse",
            json={"text": "Margherita Pizza 299"},
        )

        assert response.status_code == 503
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "MISSING_API_KEY"


def test_api_bill_parse_api_error_returns_502():
    with patch("app.get_bill_parser_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.parse_bill = AsyncMock(
            side_effect=BillParserAPIError("Failed to communicate with Gemini AI service.")
        )

        response = client.post(
            "/api/bill/parse",
            json={"text": "Margherita Pizza 299"},
        )

        assert response.status_code == 502
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "GEMINI_API_ERROR"


# ==========================================
# /api/bill/assign Tests
# ==========================================


def test_api_bill_assign_success(sample_bill_payload):
    expected_assignment = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Farmhouse Pizza", people=["B", "C"]),
            ItemAssignment(item_name="Coke", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(return_value=expected_assignment)

        response = client.post(
            "/api/bill/assign",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "A and B had the Margherita, B and C had the farmhouse, and all three had coke.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]["assignments"]) == 3
        assert data["data"]["assignments"][0]["item_name"] == "Margherita Pizza"
        assert data["data"]["assignments"][0]["people"] == ["A", "B"]


def test_api_bill_assign_ambiguity_returns_400(sample_bill_payload):
    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(
            side_effect=BillAssignmentAmbiguityError("Multiple pizzas exist on the receipt.")
        )

        response = client.post(
            "/api/bill/assign",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "John had the pizza.",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "AMBIGUOUS_INSTRUCTION"


def test_api_bill_assign_validation_error_returns_400(sample_bill_payload):
    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(
            side_effect=BillAssignmentValidationError("Assignment referenced unknown participant 'Dave'.")
        )

        response = client.post(
            "/api/bill/assign",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "Dave had the pizza.",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_ASSIGNMENT"


def test_api_bill_assign_api_error_returns_502(sample_bill_payload):
    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(
            side_effect=BillAssignmentAPIError("Failed to communicate with Gemini AI service.")
        )

        response = client.post(
            "/api/bill/assign",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "A had the pizza.",
            },
        )

        assert response.status_code == 502
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "GEMINI_API_ERROR"


# ==========================================
# /api/bill/split Tests
# ==========================================


def test_api_bill_split_success(sample_bill_payload):
    expected_assignment = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Farmhouse Pizza", people=["B", "C"]),
            ItemAssignment(item_name="Coke", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(return_value=expected_assignment)

        response = client.post(
            "/api/bill/split",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "A and B had the Margherita, B and C had the farmhouse, and all three had coke.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        split_data = data["data"]
        assert split_data["reconciled_total"] == 817.0
        assert len(split_data["shares"]) == 3

        # Verify exact reconciliation
        sum_totals = sum(s["total"] for s in split_data["shares"])
        assert round(sum_totals, 2) == 817.0


def test_api_bill_split_unassigned_items_returns_400(sample_bill_payload):
    expected_assignment = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Coke", people=["A", "B", "C"]),
        ],
        unassigned_items=["Farmhouse Pizza"],
        is_ambiguous=False,
    )

    with patch("app.get_bill_assignment_service") as mock_get_service:
        mock_service = mock_get_service.return_value
        mock_service.assign_items = AsyncMock(return_value=expected_assignment)

        response = client.post(
            "/api/bill/split",
            json={
                "bill": sample_bill_payload,
                "people": ["A", "B", "C"],
                "instruction": "A and B had the Margherita, all three had coke.",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "UNASSIGNED_ITEMS"
        assert "Farmhouse Pizza" in data["error"]["message"]
