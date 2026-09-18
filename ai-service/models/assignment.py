from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from models.bill import Bill


class ItemAssignment(BaseModel):
    """Represents consumption assignment of a specific bill item to one or more people."""

    item_name: str = Field(
        description="Exact or matched name of the bill item being assigned."
    )
    people: List[str] = Field(
        default_factory=list,
        description="List of person names who consumed/shared this item.",
    )
    quantity_shares: Optional[Dict[str, float]] = Field(
        default=None,
        description=(
            "Optional explicit mapping of person name to numeric quantity share "
            "(e.g. {'A': 1.0, 'B': 1.0}). If null, the item is split equally among assigned people."
        ),
    )


class BillAssignmentResult(BaseModel):
    """Structured LLM consumption mapping output."""

    assignments: List[ItemAssignment] = Field(
        default_factory=list,
        description="List of item-to-people assignments.",
    )
    unassigned_items: List[str] = Field(
        default_factory=list,
        description="List of bill items that were not assigned to any person.",
    )
    is_ambiguous: bool = Field(
        default=False,
        description="True if the instruction is ambiguous or refers to multiple plausible items/people.",
    )
    ambiguity_reason: Optional[str] = Field(
        default=None,
        description="Detailed reason explaining why the instruction is ambiguous.",
    )


class BillAssignRequest(BaseModel):
    """Request payload for assigning bill items via natural language."""

    bill: Bill = Field(..., description="Structured bill data containing line items.")
    people: List[str] = Field(
        ...,
        min_length=1,
        description="List of valid participants among whom the bill is split.",
    )
    instruction: str = Field(
        ...,
        min_length=1,
        description="Natural language instruction describing who consumed or shared which items.",
    )


class BillAssignResponse(BaseModel):
    """API response envelope for bill assignment."""

    success: bool = Field(default=True, description="Indicates if assignment succeeded.")
    data: BillAssignmentResult = Field(description="Structured assignment result.")
