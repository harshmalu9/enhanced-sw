import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional
from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill
from models.split import (
    BillSplitResult,
    BillSplitSummary,
    PersonItemShare,
    PersonShare,
)

logger = logging.getLogger("enhanced-sw-ai.bill-splitter")

CENT = Decimal("0.01")


def to_decimal(val: Optional[float | int | str | Decimal], default: str = "0.00") -> Decimal:
    """Safely convert numerical value to Decimal with proper precision."""
    if val is None:
        return Decimal(default)
    return Decimal(str(val))


def quantize_money(val: Decimal) -> Decimal:
    """Round Decimal money value to 2 decimal places using standard ROUND_HALF_UP."""
    return val.quantize(CENT, rounding=ROUND_HALF_UP)


class BillSplitterError(Exception):
    """Base error for deterministic bill splitting."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class UnassignedItemsError(BillSplitterError):
    """Raised when one or more items on the bill are not assigned to any person."""

    def __init__(self, unassigned_items: List[str]):
        items_str = ", ".join(f"'{it}'" for it in unassigned_items)
        message = (
            f"Cannot finalize bill split because the following item(s) are unassigned: {items_str}. "
            "Please assign all items or specify that they were shared by the group."
        )
        super().__init__(code="UNASSIGNED_ITEMS", message=message)
        self.unassigned_items = unassigned_items


class BillSplitterService:
    """
    Deterministic bill splitting service.
    Performs exact arithmetic using Python Decimal with proportional tax/discount allocation
    and penny/paisa remainder reconciliation.
    """

    def split_bill(
        self,
        bill: Bill,
        people: List[str],
        assignment_result: BillAssignmentResult,
        allow_unassigned: bool = False,
    ) -> BillSplitResult:
        """
        Deterministically calculate per-person item shares, tax, discount, and reconciled total.

        Args:
            bill: Structured Bill model.
            people: List of participant names.
            assignment_result: Item assignment mapping from LLM/service.
            allow_unassigned: If False, raises UnassignedItemsError if any bill item is unassigned.

        Returns:
            BillSplitResult: Full breakdown per person with strict total reconciliation.
        """
        if not people:
            raise ValueError("People list must contain at least one participant.")
        if not bill.items:
            raise ValueError("Bill contains no line items to split.")

        # 1. Check for unassigned items if strict
        if not allow_unassigned and assignment_result.unassigned_items:
            logger.warning("Unassigned items detected: %s", assignment_result.unassigned_items)
            raise UnassignedItemsError(assignment_result.unassigned_items)

        # Build lookup for assignments by item name
        assignment_map: Dict[str, ItemAssignment] = {
            assign.item_name.lower(): assign for assign in assignment_result.assignments
        }

        # Initialize per-person structures
        cleaned_people = [p.strip() for p in people if p and p.strip()]
        # Maintain order of people while eliminating duplicates
        seen_people = set()
        ordered_people: List[str] = []
        for p in cleaned_people:
            if p not in seen_people:
                seen_people.add(p)
                ordered_people.append(p)

        person_item_shares: Dict[str, List[PersonItemShare]] = {p: [] for p in ordered_people}
        person_subtotals: Dict[str, Decimal] = {p: Decimal("0.00") for p in ordered_people}

        # 2. Allocate item shares to assigned people
        for item in bill.items:
            item_price = to_decimal(item.total_price if item.total_price is not None else item.unit_price)
            assign = assignment_map.get(item.name.lower())

            if not assign or not assign.people:
                # Item not assigned
                continue

            if assign.quantity_shares:
                # Quantity-weighted split
                total_qty = sum(Decimal(str(q)) for q in assign.quantity_shares.values())
                if total_qty > Decimal("0.00"):
                    for p_name, qty in assign.quantity_shares.items():
                        if p_name not in person_item_shares:
                            continue
                        fraction = Decimal(str(qty)) / total_qty
                        share_amt = item_price * fraction
                        person_item_shares[p_name].append(
                            PersonItemShare(
                                item_name=item.name,
                                item_total_price=float(item_price),
                                share_fraction=float(fraction),
                                share_amount=float(quantize_money(share_amt)),
                            )
                        )
                        person_subtotals[p_name] += share_amt
            else:
                # Equal split among assigned participants
                num_assigned = Decimal(str(len(assign.people)))
                fraction = Decimal("1.0") / num_assigned
                share_amt = item_price / num_assigned

                for p_name in assign.people:
                    if p_name not in person_item_shares:
                        continue
                    person_item_shares[p_name].append(
                        PersonItemShare(
                            item_name=item.name,
                            item_total_price=float(item_price),
                            share_fraction=float(fraction),
                            share_amount=float(quantize_money(share_amt)),
                        )
                    )
                    person_subtotals[p_name] += share_amt

        # Sum of all participant subtotals
        total_items_subtotal = sum(person_subtotals.values())

        # 3. Proportional Tax, Discount, and Tip calculation
        bill_tax = to_decimal(bill.tax)
        bill_discount = to_decimal(bill.discount)
        bill_tip = to_decimal(bill.tip)

        # 4. Determine Target Reconciliation Total
        if bill.total is not None:
            target_total = quantize_money(to_decimal(bill.total))
        else:
            target_total = quantize_money(total_items_subtotal + bill_tax - bill_discount + bill_tip)

        person_taxes: Dict[str, Decimal] = {}
        person_discounts: Dict[str, Decimal] = {}
        person_tips: Dict[str, Decimal] = {}
        person_raw_totals: Dict[str, Decimal] = {}

        for p in ordered_people:
            p_sub = person_subtotals[p]
            if total_items_subtotal > Decimal("0.00"):
                ratio = p_sub / total_items_subtotal
                p_tax = bill_tax * ratio
                p_disc = bill_discount * ratio
                p_tp = bill_tip * ratio
            else:
                p_tax = Decimal("0.00")
                p_disc = Decimal("0.00")
                p_tp = Decimal("0.00")

            person_taxes[p] = quantize_money(p_tax)
            person_discounts[p] = quantize_money(p_disc)
            person_tips[p] = quantize_money(p_tp)

            p_tot = quantize_money(p_sub) + person_taxes[p] - person_discounts[p] + person_tips[p]
            person_raw_totals[p] = p_tot

        # 5. Deterministic Penny/Paisa Remainder Reconciliation
        # Discrepancy between target total and sum of rounded person totals
        sum_calculated = sum(person_raw_totals.values())
        remainder = target_total - sum_calculated

        # Sort people by highest subtotal descending to distribute odd paise deterministically
        sorted_by_share = sorted(
            ordered_people,
            key=lambda p: (person_subtotals[p], p),
            reverse=True,
        )

        final_person_totals = {p: person_raw_totals[p] for p in ordered_people}

        if remainder != Decimal("0.00") and len(sorted_by_share) > 0:
            cents_step = CENT if remainder > 0 else -CENT
            cents_count = int(abs(remainder) / CENT)

            logger.info(
                "Reconciling rounding discrepancy of %s (%d cents) across %d people.",
                remainder,
                cents_count,
                len(sorted_by_share),
            )

            idx = 0
            while cents_count > 0:
                target_person = sorted_by_share[idx % len(sorted_by_share)]
                final_person_totals[target_person] += cents_step
                cents_count -= 1
                idx += 1

        # 6. Build PersonShare objects
        person_shares: List[PersonShare] = []
        for p in ordered_people:
            person_shares.append(
                PersonShare(
                    person=p,
                    items=person_item_shares[p],
                    subtotal=float(quantize_money(person_subtotals[p])),
                    tax=float(person_taxes[p]),
                    discount=float(person_discounts[p]),
                    tip=float(person_tips[p]),
                    total=float(final_person_totals[p]),
                )
            )

        bill_summary = BillSplitSummary(
            merchant=bill.merchant,
            total=float(target_total),
            currency=bill.currency or "INR",
            subtotal=float(quantize_money(total_items_subtotal)) if bill.subtotal is not None or total_items_subtotal > 0 else None,
            tax=float(quantize_money(bill_tax)) if bill.tax is not None else None,
            discount=float(quantize_money(bill_discount)) if bill.discount is not None else None,
            tip=float(quantize_money(bill_tip)) if bill.tip is not None else None,
        )

        reconciled_sum = float(sum(final_person_totals.values()))

        return BillSplitResult(
            bill=bill_summary,
            assignments=assignment_result.assignments,
            shares=person_shares,
            reconciled_total=reconciled_sum,
        )


# Module-level singleton
_bill_splitter_service: Optional[BillSplitterService] = None


def get_bill_splitter_service() -> BillSplitterService:
    """Return singleton instance of BillSplitterService."""
    global _bill_splitter_service
    if _bill_splitter_service is None:
        _bill_splitter_service = BillSplitterService()
    return _bill_splitter_service
