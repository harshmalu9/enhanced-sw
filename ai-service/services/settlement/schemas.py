from typing import List, Optional
from pydantic import BaseModel, Field


class ParticipantPayment(BaseModel):
    person: str = Field(..., min_length=1)
    amount_paid: float = Field(..., ge=0)
    custom_share: Optional[float] = Field(default=None, ge=0)


class ParticipantBalance(BaseModel):
    person: str
    amount_paid: float
    fair_share: float
    net_balance: float  # Positive: creditor (gets back), Negative: debtor (owes)


class SettlementTransfer(BaseModel):
    from_person: str
    to_person: str
    amount: float
    instruction: str


class GroupSettlementRequest(BaseModel):
    title: Optional[str] = "Group Expense Settlement"
    payments: List[ParticipantPayment] = Field(..., min_length=2)


class GroupSettlementResponse(BaseModel):
    success: bool
    title: str
    total_group_spent: float
    fair_share_per_person: Optional[float] = None
    balances: List[ParticipantBalance]
    transfers: List[SettlementTransfer]
    total_transfers_count: int
    is_settled: bool
