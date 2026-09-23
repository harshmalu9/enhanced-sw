import pytest
from fastapi.testclient import TestClient
from app import app
from services.settlement import (
    GroupSettlementRequest,
    ParticipantPayment,
    get_debt_settlement_service,
)

client = TestClient(app)


def test_debt_settlement_exact_example_from_spec():
    """
    Scenario:
    A paid ₹900
    B paid ₹300
    C paid ₹0
    Total = ₹1200, Fair share = ₹400 each
    Net balances:
    A = +500
    B = -100
    C = -400
    Expected transfers:
    C -> A ₹400
    B -> A ₹100
    """
    service = get_debt_settlement_service()
    req = GroupSettlementRequest(
        title="Trip Split",
        payments=[
            ParticipantPayment(person="A", amount_paid=900.0),
            ParticipantPayment(person="B", amount_paid=300.0),
            ParticipantPayment(person="C", amount_paid=0.0),
        ],
    )
    res = service.simplify_debts(req)
    assert res.success is True
    assert res.total_group_spent == 1200.0
    assert res.fair_share_per_person == 400.0
    assert len(res.transfers) == 2

    # Check transfers
    transfer_map = {(t.from_person, t.to_person): t.amount for t in res.transfers}
    assert transfer_map.get(("C", "A")) == 400.0
    assert transfer_map.get(("B", "A")) == 100.0


def test_debt_settlement_already_equal():
    service = get_debt_settlement_service()
    req = GroupSettlementRequest(
        payments=[
            ParticipantPayment(person="Alice", amount_paid=500.0),
            ParticipantPayment(person="Bob", amount_paid=500.0),
        ]
    )
    res = service.simplify_debts(req)
    assert res.success is True
    assert len(res.transfers) == 0
    assert res.is_settled is True


def test_debt_settlement_rejects_single_participant_or_duplicates():
    service = get_debt_settlement_service()
    with pytest.raises(Exception):
        service.simplify_debts(
            GroupSettlementRequest(
                payments=[ParticipantPayment(person="Alice", amount_paid=100.0)]
            )
        )

    with pytest.raises(ValueError, match="Duplicate"):
        service.simplify_debts(
            GroupSettlementRequest(
                payments=[
                    ParticipantPayment(person="Alice", amount_paid=100.0),
                    ParticipantPayment(person="Alice", amount_paid=200.0),
                ]
            )
        )


def test_api_settlement_endpoint():
    payload = {
        "title": "Weekend Dinner",
        "payments": [
            {"person": "Rahul", "amount_paid": 1500.0},
            {"person": "Priya", "amount_paid": 500.0},
            {"person": "Amit", "amount_paid": 400.0},
        ],
    }
    response = client.post("/api/settlement/simplify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["total_group_spent"] == 2400.0
    assert data["fair_share_per_person"] == 800.0
    assert len(data["transfers"]) > 0
