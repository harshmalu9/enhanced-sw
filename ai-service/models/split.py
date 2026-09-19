from typing import List, Optional
from pydantic import BaseModel, Field
from models.assignment import ItemAssignment
from models.bill import Bill, BillValidationResult


class PersonItemShare(BaseModel):
    """Detailed breakdown of a person's individual share of a specific bill item."""

    item_name: str = Field(description="Name of the bill item.")
    item_total_price: float = Field(description="Total price of the item on the bill.")
    share_fraction: float = Field(
        description="Fraction of the item consumed (e.g. 0.5 for 2-way equal share, 0.3333 for 3-way)."
    )
    share_amount: float = Field(description="Monetary amount owed by this person for this item.")


class PersonShare(BaseModel):
    """Aggregated bill share for an individual participant including items, tax, and discount."""

    person: str = Field(description="Participant name.")
    items: List[PersonItemShare] = Field(
        default_factory=list,
        description="List of individual item shares allocated to this person.",
    )
    subtotal: float = Field(
        description="Sum of all allocated item share amounts for this person before tax/discount."
    )
    tax: float = Field(
        default=0.0,
        description="Proportionally allocated tax amount.",
    )
    discount: float = Field(
        default=0.0,
        description="Proportionally allocated discount amount deducted from share.",
    )
    tip: float = Field(
        default=0.0,
        description="Proportionally allocated tip or service fee.",
    )
    total: float = Field(
        description="Final reconciled total amount payable by this person."
    )


class BillSplitSummary(BaseModel):
    """Overview of the bill being split."""

    merchant: Optional[str] = Field(default=None, description="Merchant name.")
    total: float = Field(description="Bill final total amount.")
    currency: str = Field(default="INR", description="Currency code.")
    subtotal: Optional[float] = Field(default=None, description="Bill subtotal.")
    tax: Optional[float] = Field(default=None, description="Bill tax total.")
    discount: Optional[float] = Field(default=None, description="Bill discount total.")
    tip: Optional[float] = Field(default=None, description="Bill tip / service charge total.")


class BillSplitResult(BaseModel):
    """Complete end-to-end bill split output with assignments, shares, and reconciliation."""

    bill: BillSplitSummary = Field(description="Summary of the bill.")
    assignments: List[ItemAssignment] = Field(
        description="Item-to-person consumption assignments."
    )
    shares: List[PersonShare] = Field(
        description="Individual per-person breakdown of amounts owed."
    )
    reconciled_total: float = Field(
        description="Sum of all person totals, strictly reconciled to match bill total."
    )


class BillSplitRequest(BaseModel):
    """Request payload for end-to-end bill splitting."""

    bill: Bill = Field(..., description="Structured bill data.")
    people: List[str] = Field(
        ...,
        min_length=1,
        description="List of participants sharing the bill.",
    )
    instruction: str = Field(
        ...,
        min_length=1,
        description="Natural language instruction for item consumption mapping.",
    )


class BillSplitResponse(BaseModel):
    """API response envelope for bill split."""

    success: bool = Field(default=True, description="Indicates if split succeeded.")
    data: BillSplitResult = Field(description="Calculated bill split results.")
    validation: Optional[BillValidationResult] = Field(
        default=None,
        description="Deterministic consistency validation results for the extracted bill amounts.",
    )
