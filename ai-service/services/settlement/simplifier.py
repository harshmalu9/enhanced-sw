from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple
from .schemas import (
    GroupSettlementRequest,
    GroupSettlementResponse,
    ParticipantBalance,
    SettlementTransfer,
)

TWOPLACES = Decimal("0.01")


def quantize(val: Decimal) -> Decimal:
    return val.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


class DebtSettlementService:
    """
    Deterministic minimum cash-flow debt simplification engine.
    Computes exact net balances and generates the minimal graph of transfers
    so everyone is settled with O(N) payments.
    """

    def simplify_debts(self, request: GroupSettlementRequest) -> GroupSettlementResponse:
        payments = request.payments
        n = len(payments)

        if n < 2:
            raise ValueError("Group debt simplification requires at least two participants.")

        # Ensure no duplicate names
        names = [p.person.strip() for p in payments]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate participant names found in settlement request.")

        # Sum total spent using Decimal
        total_spent = sum(Decimal(str(p.amount_paid)) for p in payments)
        total_spent = quantize(total_spent)

        if total_spent == Decimal("0.00"):
            balances = [
                ParticipantBalance(
                    person=p.person.strip(),
                    amount_paid=0.0,
                    fair_share=0.0,
                    net_balance=0.0,
                )
                for p in payments
            ]
            return GroupSettlementResponse(
                success=True,
                title=request.title or "Group Expense Settlement",
                total_group_spent=0.0,
                fair_share_per_person=0.0,
                balances=balances,
                transfers=[],
                total_transfers_count=0,
                is_settled=True,
            )

        # Determine fair shares
        has_custom = any(p.custom_share is not None for p in payments)
        fair_shares: List[Decimal] = []

        if has_custom:
            for p in payments:
                if p.custom_share is not None:
                    fair_shares.append(quantize(Decimal(str(p.custom_share))))
                else:
                    fair_shares.append(Decimal("0.00"))
        else:
            # Equal division with exact penny reconciliation
            base_share = (total_spent / Decimal(n)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
            fair_shares = [base_share] * n
            diff = total_spent - sum(fair_shares)
            # Reconcile penny diff across first |diff| participants
            cents = int((diff * Decimal("100")).to_integral_value())
            if cents > 0:
                for i in range(min(cents, n)):
                    fair_shares[i] += Decimal("0.01")
            elif cents < 0:
                for i in range(min(abs(cents), n)):
                    fair_shares[i] -= Decimal("0.01")

        # Calculate net balances: paid - fair_share
        balances_list: List[ParticipantBalance] = []
        debtors: List[List[Any]] = []  # [[name, debt_amount_decimal]]
        creditors: List[List[Any]] = []  # [[name, credit_amount_decimal]]

        for i, p in enumerate(payments):
            name = p.person.strip()
            paid = quantize(Decimal(str(p.amount_paid)))
            share = fair_shares[i]
            net = paid - share

            balances_list.append(
                ParticipantBalance(
                    person=name,
                    amount_paid=float(paid),
                    fair_share=float(share),
                    net_balance=float(net),
                )
            )

            if net < Decimal("-0.001"):
                debtors.append([name, abs(net)])
            elif net > Decimal("0.001"):
                creditors.append([name, net])

        # Minimum cash flow greedy matching
        transfers: List[SettlementTransfer] = []

        while debtors and creditors:
            # Sort descending to match largest debtor with largest creditor
            debtors.sort(key=lambda d: d[1], reverse=True)
            creditors.sort(key=lambda c: c[1], reverse=True)

            debtor = debtors[0]
            creditor = creditors[0]

            amount = min(debtor[1], creditor[1])
            amount = quantize(amount)

            if amount > Decimal("0.00"):
                transfers.append(
                    SettlementTransfer(
                        from_person=debtor[0],
                        to_person=creditor[0],
                        amount=float(amount),
                        instruction=f"{debtor[0]} pays {creditor[0]} ₹{float(amount):,.2f}",
                    )
                )

            debtor[1] -= amount
            creditor[1] -= amount

            if debtor[1] <= Decimal("0.001"):
                debtors.pop(0)
            if creditor[1] <= Decimal("0.001"):
                creditors.pop(0)

        equal_fair_share = float(quantize(total_spent / Decimal(n))) if not has_custom else None

        return GroupSettlementResponse(
            success=True,
            title=request.title or "Group Expense Settlement",
            total_group_spent=float(total_spent),
            fair_share_per_person=equal_fair_share,
            balances=balances_list,
            transfers=transfers,
            total_transfers_count=len(transfers),
            is_settled=len(transfers) == 0,
        )


_debt_settlement_instance = None


def get_debt_settlement_service() -> DebtSettlementService:
    global _debt_settlement_instance
    if _debt_settlement_instance is None:
        _debt_settlement_instance = DebtSettlementService()
    return _debt_settlement_instance
