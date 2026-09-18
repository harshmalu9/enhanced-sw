import pytest
from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill, BillItem
from services.bill_splitter import (
    BillSplitterService,
    UnassignedItemsError,
)


def test_equal_split_two_people():
    bill = Bill(
        merchant="Pizzeria",
        items=[
            BillItem(name="Margherita Pizza", total_price=300.0),
        ],
        subtotal=300.0,
        total=300.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B"], assignments)

    assert result.reconciled_total == 300.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].subtotal == 150.0
    assert shares["A"].total == 150.0
    assert shares["B"].subtotal == 150.0
    assert shares["B"].total == 150.0


def test_three_way_equal_split():
    bill = Bill(
        merchant="Cafe",
        items=[
            BillItem(name="Pasta", total_price=300.0),
        ],
        subtotal=300.0,
        total=300.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Pasta", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B", "C"], assignments)

    assert result.reconciled_total == 300.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].total == 100.0
    assert shares["B"].total == 100.0
    assert shares["C"].total == 100.0


def test_different_items_overlapping_participants():
    # Pizza ₹600 -> A, B; Drink ₹300 -> B, C
    # Expected: A = ₹300, B = ₹300 + ₹150 = ₹450, C = ₹150
    bill = Bill(
        merchant="Bistro",
        items=[
            BillItem(name="Pizza", total_price=600.0),
            BillItem(name="Drink", total_price=300.0),
        ],
        subtotal=900.0,
        total=900.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Drink", people=["B", "C"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B", "C"], assignments)

    assert result.reconciled_total == 900.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].subtotal == 300.0
    assert shares["A"].total == 300.0
    assert shares["B"].subtotal == 450.0
    assert shares["B"].total == 450.0
    assert shares["C"].subtotal == 150.0
    assert shares["C"].total == 150.0


def test_proportional_tax_allocation():
    # Subtotal ₹1000, Tax ₹180, Total ₹1180
    # A subtotal ₹600 -> Tax ₹108, Total ₹708
    # B subtotal ₹400 -> Tax ₹72, Total ₹472
    bill = Bill(
        merchant="Restaurant",
        items=[
            BillItem(name="Expensive Dish", total_price=600.0),
            BillItem(name="Regular Dish", total_price=400.0),
        ],
        subtotal=1000.0,
        tax=180.0,
        total=1180.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Expensive Dish", people=["A"]),
            ItemAssignment(item_name="Regular Dish", people=["B"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B"], assignments)

    assert result.reconciled_total == 1180.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].subtotal == 600.0
    assert shares["A"].tax == 108.0
    assert shares["A"].total == 708.0

    assert shares["B"].subtotal == 400.0
    assert shares["B"].tax == 72.0
    assert shares["B"].total == 472.0


def test_proportional_discount_and_tip_allocation():
    # Subtotal ₹1000, Discount ₹100, Tax ₹50, Tip ₹50, Total ₹1000
    # A subtotal ₹600 (60%) -> Discount ₹60, Tax ₹30, Tip ₹30 -> Total ₹600
    # B subtotal ₹400 (40%) -> Discount ₹40, Tax ₹20, Tip ₹20 -> Total ₹400
    bill = Bill(
        merchant="Diner",
        items=[
            BillItem(name="Item 1", total_price=600.0),
            BillItem(name="Item 2", total_price=400.0),
        ],
        subtotal=1000.0,
        tax=50.0,
        discount=100.0,
        tip=50.0,
        total=1000.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Item 1", people=["A"]),
            ItemAssignment(item_name="Item 2", people=["B"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B"], assignments)

    assert result.reconciled_total == 1000.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].discount == 60.0
    assert shares["A"].tax == 30.0
    assert shares["A"].tip == 30.0
    assert shares["A"].total == 600.0

    assert shares["B"].discount == 40.0
    assert shares["B"].tax == 20.0
    assert shares["B"].tip == 20.0
    assert shares["B"].total == 400.0


def test_rounding_and_penny_reconciliation():
    # ₹100 split among 3 people (A, B, C)
    # Exact 100 / 3 = 33.333333...
    # Reconciled sum must equal 100.00 exactly (e.g. 33.34 + 33.33 + 33.33 = 100.00)
    bill = Bill(
        merchant="Tavern",
        items=[
            BillItem(name="Shared Meal", total_price=100.0),
        ],
        subtotal=100.0,
        total=100.0,
        currency="INR",
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Shared Meal", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B", "C"], assignments)

    assert result.reconciled_total == 100.0
    sum_individual = sum(s.total for s in result.shares)
    assert sum_individual == 100.0
    # Verify exact per-person amounts
    totals = sorted([s.total for s in result.shares], reverse=True)
    assert totals == [33.34, 33.33, 33.33]


def test_unassigned_items_raises_error():
    bill = Bill(
        merchant="Pizza Hut",
        items=[
            BillItem(name="Pizza", total_price=300.0),
            BillItem(name="Garlic Bread", total_price=120.0),
        ],
        total=420.0,
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Pizza", people=["A", "B"]),
        ],
        unassigned_items=["Garlic Bread"],
    )
    splitter = BillSplitterService()
    with pytest.raises(UnassignedItemsError) as exc_info:
        splitter.split_bill(bill, ["A", "B"], assignments, allow_unassigned=False)
    assert "Garlic Bread" in str(exc_info.value)
    assert exc_info.value.code == "UNASSIGNED_ITEMS"


def test_explicit_quantity_shares():
    # 2 pizzas @ ₹300 = ₹600. A ate 1, B ate 1.
    bill = Bill(
        merchant="Pizzeria",
        items=[
            BillItem(name="Margherita Pizza", quantity=2, total_price=600.0),
        ],
        total=600.0,
    )
    assignments = BillAssignmentResult(
        assignments=[
            ItemAssignment(
                item_name="Margherita Pizza",
                people=["A", "B"],
                quantity_shares={"A": 1.0, "B": 1.0},
            ),
        ],
        unassigned_items=[],
    )
    splitter = BillSplitterService()
    result = splitter.split_bill(bill, ["A", "B"], assignments)

    assert result.reconciled_total == 600.0
    shares = {s.person: s for s in result.shares}
    assert shares["A"].total == 300.0
    assert shares["B"].total == 300.0
