from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional

from services.spending.schemas import (
    ExpenseItem,
    HighestCategoryInfo,
    LargestExpenseInfo,
    SpendingSummary,
)

TWO_PLACES = Decimal("0.01")


def round_cents(value: Decimal) -> float:
    """Deterministically round Decimal to 2 decimal places using ROUND_HALF_UP."""
    return float(value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


class SpendingAnalyzer:
    """
    Deterministic spending data aggregator.
    Performs exact arithmetic, category grouping, percentage computations,
    and extreme-value lookups using Python Decimal.
    """

    @staticmethod
    def analyze(expenses: List[ExpenseItem]) -> SpendingSummary:
        """
        Compute deterministic summary statistics over a list of expenses.

        Args:
            expenses: Validated list of ExpenseItem instances.

        Returns:
            SpendingSummary: Mathematical breakdown of total, average, category sums,
                            percentages, highest category, and largest transaction.
        """
        if not expenses:
            return SpendingSummary(
                total_spending=0.0,
                expense_count=0,
                average_expense=0.0,
                spending_by_category={},
                category_percentages={},
                highest_spending_category=None,
                largest_expense=None,
            )

        total_dec = Decimal("0.00")
        category_sums_dec: Dict[str, Decimal] = {}
        largest_item: Optional[ExpenseItem] = None
        largest_amount_dec = Decimal("-1")

        for item in expenses:
            amt_dec = Decimal(str(item.amount))
            total_dec += amt_dec

            cat = item.category
            category_sums_dec[cat] = category_sums_dec.get(cat, Decimal("0.00")) + amt_dec

            if amt_dec > largest_amount_dec:
                largest_amount_dec = amt_dec
                largest_item = item

        expense_count = len(expenses)
        avg_dec = total_dec / Decimal(expense_count)
        average_expense = round_cents(avg_dec)
        total_spending = round_cents(total_dec)

        spending_by_category: Dict[str, float] = {}
        category_percentages: Dict[str, float] = {}

        for cat, cat_sum_dec in category_sums_dec.items():
            cat_sum_float = round_cents(cat_sum_dec)
            spending_by_category[cat] = cat_sum_float

            if total_dec > Decimal("0.00"):
                pct_dec = (cat_sum_dec / total_dec) * Decimal("100")
                category_percentages[cat] = round_cents(pct_dec)
            else:
                category_percentages[cat] = 0.0

        # Find highest spending category
        highest_cat_info: Optional[HighestCategoryInfo] = None
        if category_sums_dec:
            # Sort categories by total spending descending
            sorted_cats = sorted(
                category_sums_dec.items(),
                key=lambda kv: kv[1],
                reverse=True,
            )
            top_cat, top_cat_sum_dec = sorted_cats[0]
            top_pct = category_percentages.get(top_cat, 0.0)
            highest_cat_info = HighestCategoryInfo(
                category=top_cat,
                amount=round_cents(top_cat_sum_dec),
                percentage=top_pct,
            )

        # Build largest expense info
        largest_exp_info: Optional[LargestExpenseInfo] = None
        if largest_item is not None:
            largest_exp_info = LargestExpenseInfo(
                description=largest_item.description,
                amount=round_cents(Decimal(str(largest_item.amount))),
                category=largest_item.category,
                merchant=largest_item.merchant,
            )

        return SpendingSummary(
            total_spending=total_spending,
            expense_count=expense_count,
            average_expense=average_expense,
            spending_by_category=spending_by_category,
            category_percentages=category_percentages,
            highest_spending_category=highest_cat_info,
            largest_expense=largest_exp_info,
        )
