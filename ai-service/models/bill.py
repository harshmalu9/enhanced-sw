from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class BillItem(BaseModel):
    """Represents a single line item purchased on a bill."""

    name: str = Field(
        description="Clean, normalized name or description of the purchased item."
    )
    quantity: Optional[float] = Field(
        default=1.0,
        description="Quantity of the item purchased (defaults to 1 if unspecified).",
    )
    unit_price: Optional[float] = Field(
        default=None,
        description="Price per single unit if explicitly listed on receipt, otherwise null.",
    )
    total_price: Optional[float] = Field(
        default=None,
        description="Total price for this line item (e.g. quantity * unit_price or listed price).",
    )


class Bill(BaseModel):
    """Structured representation of a normalized receipt or bill."""

    merchant: Optional[str] = Field(
        default=None,
        description="Normalized merchant/restaurant/store name if identified, otherwise null.",
    )
    items: List[BillItem] = Field(
        default_factory=list,
        description="List of purchased line items extracted from the receipt.",
    )
    subtotal: Optional[float] = Field(
        default=None,
        description="Subtotal amount before taxes or discounts if explicitly present, otherwise null.",
    )
    tax: Optional[float] = Field(
        default=None,
        description="Total tax amount (e.g. GST, VAT, sales tax) if explicitly present, otherwise null.",
    )
    discount: Optional[float] = Field(
        default=None,
        description="Total discount amount applied if explicitly present on receipt, otherwise null.",
    )
    tip: Optional[float] = Field(
        default=None,
        description="Tip or service fee if explicitly present on receipt, otherwise null.",
    )
    total: Optional[float] = Field(
        default=None,
        description="Final total amount payable if present on receipt, otherwise null.",
    )
    currency: Optional[str] = Field(
        default="INR",
        description="Standard 3-letter currency code (e.g. INR, USD, EUR, GBP).",
    )
    confidence: Optional[Literal["high", "medium", "low"]] = Field(
        default="medium",
        description=(
            "Extraction confidence rating: "
            "'high' if text is clear and all totals mathematically align; "
            "'medium' if mild OCR corrections were made or non-critical fields are absent; "
            "'low' if OCR is heavily noisy or totals/items are ambiguous."
        ),
    )


class BillValidationResult(BaseModel):
    """Deterministic validation metadata checking if extracted bill components reconcile."""

    is_consistent: bool = Field(
        default=True,
        description="True if the extracted monetary components mathematically reconcile with the total.",
    )
    difference: Optional[float] = Field(
        default=None,
        description="Difference between the extracted total and calculated total, if both can be evaluated.",
    )
    expected_total: Optional[float] = Field(
        default=None,
        description="Calculated total based on items/subtotal + tax + tip - discount, if calculable.",
    )
    items_total: Optional[float] = Field(
        default=None,
        description="Sum of all individual line item total prices.",
    )
    message: Optional[str] = Field(
        default=None,
        description="Human-readable explanation of consistency status or discrepancy detected.",
    )


class BillParseRequest(BaseModel):
    """Request payload for OCR bill parsing."""

    text: str = Field(
        ...,
        min_length=1,
        description="Raw OCR text extracted from the receipt to be parsed.",
    )


class BillParseResponse(BaseModel):
    """API response envelope containing parsed bill data."""

    success: bool = Field(default=True, description="Indicates if parsing succeeded.")
    data: Bill = Field(description="Normalized structured bill data.")
    validation: Optional[BillValidationResult] = Field(
        default=None,
        description="Deterministic consistency validation results for the extracted bill amounts.",
    )

