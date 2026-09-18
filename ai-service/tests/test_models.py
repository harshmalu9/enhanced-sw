import pytest
from pydantic import ValidationError
from models.bill import Bill, BillItem, BillParseRequest, BillParseResponse


def test_bill_item_valid():
    item = BillItem(
        name="Margherita Pizza",
        quantity=2,
        unit_price=299.0,
        total_price=598.0,
    )
    assert item.name == "Margherita Pizza"
    assert item.quantity == 2.0
    assert item.unit_price == 299.0
    assert item.total_price == 598.0


def test_bill_item_defaults():
    item = BillItem(name="Coke")
    assert item.name == "Coke"
    assert item.quantity == 1.0
    assert item.unit_price is None
    assert item.total_price is None


def test_bill_valid():
    bill = Bill(
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
    assert bill.merchant == "Domino's Pizza"
    assert len(bill.items) == 3
    assert bill.subtotal == 778.0
    assert bill.tax == 3.0
    assert bill.discount is None
    assert bill.total == 817.0
    assert bill.currency == "INR"
    assert bill.confidence == "high"


def test_bill_missing_data_preserves_none():
    bill = Bill(
        items=[
            BillItem(name="Margherita Pizza", total_price=299.0),
            BillItem(name="Coke", total_price=80.0),
        ]
    )
    assert bill.merchant is None
    assert bill.subtotal is None
    assert bill.tax is None
    assert bill.discount is None
    assert bill.tip is None
    assert bill.total is None
    assert len(bill.items) == 2


def test_bill_parse_request_validation():
    req = BillParseRequest(text="DOMINOS\nPizza 299")
    assert req.text == "DOMINOS\nPizza 299"

    with pytest.raises(ValidationError):
        BillParseRequest(text="")


def test_bill_validation_result_and_response():
    from models.bill import BillValidationResult

    val = BillValidationResult(
        is_consistent=False,
        difference=36.0,
        expected_total=781.0,
        items_total=778.0,
        message="Discrepancy detected",
    )
    assert val.is_consistent is False
    assert val.difference == 36.0
    assert val.expected_total == 781.0

    bill = Bill(
        merchant="Domino's Pizza",
        subtotal=778.0,
        tax=3.0,
        total=817.0,
    )
    resp = BillParseResponse(
        success=True,
        data=bill,
        validation=val,
    )
    assert resp.success is True
    assert resp.data.merchant == "Domino's Pizza"
    assert resp.validation.difference == 36.0

