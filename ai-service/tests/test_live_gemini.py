import os
import pytest
from dotenv import load_dotenv
from models.bill import Bill, BillItem
from services.bill_assignment import (
    BillAssignmentAmbiguityError,
    BillAssignmentService,
)
from services.bill_parser import BillParserService
from services.bill_splitter import BillSplitterService

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")
RUN_LIVE = os.getenv("RUN_LIVE_TESTS", "").lower() in ("true", "1", "yes")
pytestmark = pytest.mark.skipif(
    not RUN_LIVE or not API_KEY or API_KEY.startswith("your_") or API_KEY == "fake_key",
    reason="Live tests require RUN_LIVE_TESTS=true and valid GOOGLE_API_KEY",
)


@pytest.fixture
def dominos_bill():
    return Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, total_price=399.0),
            BillItem(name="Coke", quantity=1, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        total=817.0,
        currency="INR",
    )


@pytest.mark.asyncio
async def test_live_bill_parser_real_ocr():
    service = BillParserService()
    ocr_text = """DOMINOSPIZZAE
Margherita Pizza 299
Farmhouse Pizza 399
Coke
80
Subtotal
778
GST
3
Total
817"""
    from services.bill_parser import validate_bill_consistency

    bill = await service.parse_bill(ocr_text)
    assert len(bill.items) == 3
    assert bill.subtotal == 778.0
    assert bill.tax == 3.0
    assert bill.total == 817.0
    item_names = [it.name.lower() for it in bill.items]
    assert any("margherita" in name for name in item_names)
    assert any("farmhouse" in name for name in item_names)
    assert any("coke" in name for name in item_names)

    val = validate_bill_consistency(bill)
    assert val.is_consistent is False
    assert val.difference == 36.0



@pytest.mark.asyncio
async def test_live_bill_assignment_exact(dominos_bill):
    service = BillAssignmentService()
    people = ["A", "B", "C"]
    instruction = "A and B had the Margherita Pizza. B and C had the Farmhouse Pizza. A, B and C had the Coke."

    result = await service.assign_items(
        bill=dominos_bill,
        people=people,
        instruction=instruction,
    )

    assert result.is_ambiguous is False
    assert len(result.assignments) == 3
    for assign in result.assignments:
        for p in assign.people:
            assert p in people


@pytest.mark.asyncio
async def test_live_bill_assignment_natural_variation():
    # Single pizza on bill: "A and B had the pizza, C had the coke."
    simple_bill = Bill(
        merchant="Pizzeria",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, total_price=300.0),
            BillItem(name="Coke", quantity=1, total_price=80.0),
        ],
        subtotal=380.0,
        total=380.0,
        currency="INR",
    )
    service = BillAssignmentService()
    people = ["A", "B", "C"]
    instruction = "A and B had the pizza, C had the coke."

    result = await service.assign_items(
        bill=simple_bill,
        people=people,
        instruction=instruction,
    )

    assert result.is_ambiguous is False
    assert len(result.assignments) == 2
    for assign in result.assignments:
        for p in assign.people:
            assert p in people


@pytest.mark.asyncio
async def test_live_bill_assignment_ambiguous(dominos_bill):
    # Two pizzas exist on dominos_bill: "John had the pizza" is ambiguous
    service = BillAssignmentService()
    people = ["A", "B", "C"]
    instruction = "A had the pizza, B had coke."

    with pytest.raises(BillAssignmentAmbiguityError):
        await service.assign_items(
            bill=dominos_bill,
            people=people,
            instruction=instruction,
        )


@pytest.mark.asyncio
async def test_live_end_to_end_split(dominos_bill):
    assignment_service = BillAssignmentService()
    splitter_service = BillSplitterService()
    people = ["A", "B", "C"]
    instruction = "A and B had the Margherita, B and C had the farmhouse, and all three had coke."

    assignments = await assignment_service.assign_items(
        bill=dominos_bill,
        people=people,
        instruction=instruction,
    )

    split = splitter_service.split_bill(
        bill=dominos_bill,
        people=people,
        assignment_result=assignments,
    )

    assert split.reconciled_total == 817.0
    sum_totals = sum(s.total for s in split.shares)
    assert round(sum_totals, 2) == 817.0
