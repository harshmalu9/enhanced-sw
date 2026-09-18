import logging
import os
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from models.bill import Bill, BillValidationResult

logger = logging.getLogger("enhanced-sw-ai.bill-parser")

BILL_EXTRACTION_SYSTEM_PROMPT = """You are an expert receipt and bill extraction AI.
Your task is to analyze raw, potentially messy OCR text extracted from receipts or invoices and convert it into a strictly structured JSON bill object.

Key Guidelines:
1. Handling OCR Noise & Layout Issues:
   - OCR text often contains typos, merged words (e.g., 'Margherita Pizza299' -> name: 'Margherita Pizza', total_price: 299), misaligned numbers, or words split across lines (e.g., item name on one line and price/quantity on the following line).
   - Reconstruct obvious item and price relationships based on context and reading order.
   - Normalize merchant/restaurant/store names when obvious from context (e.g., 'DOMINOSPIZZAE' -> 'Domino\'s Pizza').

2. Extraction Constraints & Fidelity to OCR (CRITICAL RULE):
   - CRITICAL: Extract the EXACT monetary amounts explicitly labeled or present in the OCR text.
   - NEVER recalculate, adjust, invent, or force-balance numbers.
   - If OCR explicitly contains a labeled monetary value, preserve that exact value (e.g., if OCR says 'GST' followed by '3', extract 'tax': 3. DO NOT compute 817 - 778 = 39).
   - Do NOT replace an explicitly extracted value with a mathematically inferred value merely because the numbers do not reconcile.
   - The LLM's job is strictly OCR extraction and normalization, NOT recomputing tax, subtotal, or forcing the bill to balance.
   - Specific field mappings:
     * 'tax': Explicitly stated tax amounts (GST, CGST, SGST, VAT, Sales Tax). If a tax line explicitly states 3, tax MUST be 3. If multiple explicit tax lines exist (e.g., CGST 1.5, SGST 1.5), sum the explicit values.
     * 'subtotal': Explicitly labeled Subtotal / Net Amount.
     * 'discount': Explicitly labeled Discount / Promo.
     * 'tip': Explicitly labeled Tip / Service Charge / Gratuity.
     * 'total': Explicitly labeled Total / Grand Total / Amount Payable.
   - Distinguish purchased line items from summary metadata (Subtotal, GST/CGST/SGST/VAT, Tax, Discounts, Service Charge, Tip, Round Off, Grand Total).
   - If an item's quantity is not explicitly stated, default quantity to 1.
   - For line items, extract 'unit_price' only if explicitly listed; calculate or extract 'total_price' for the item.

3. Priority Hierarchy:
   1. Explicitly labeled value in OCR text.
   2. Clearly associated value based on OCR reading order and structure.
   3. If absent, leave as null (None). Do NOT guess, compute, or invent values to balance the arithmetic.
   - Do NOT assume a field is 0 unless the receipt explicitly states 0.

4. Currency:
   - Detect the currency from symbols or context (e.g., ₹ / Rs / INR -> 'INR', $ -> 'USD', € -> 'EUR', £ -> 'GBP').
   - Default to 'INR' if no other currency is indicated and the text reflects standard Indian restaurant/store patterns.

5. Confidence Evaluation:
   - 'high': Receipt text is clear, items and prices are unambiguous, and totals (subtotal + tax - discount) match or are mathematically consistent.
   - 'medium': Mild OCR errors required reconstruction, or extracted fields are present but do not mathematically reconcile, or non-critical summary fields are absent while items and total are clear.
   - 'low': OCR is severely degraded, key numbers are ambiguous, or items cannot be reliably identified.
"""


def validate_bill_consistency(bill: Bill, tolerance: Decimal = Decimal("0.05")) -> BillValidationResult:
    """
    Deterministically validate whether the extracted bill components reconcile with the total using Decimal arithmetic.

    Reconciliation formula:
        expected_total = subtotal + tax + tip - discount

    If subtotal is missing but item total prices are present, the sum of line items is used as the base.
    """
    # 1. Sum item total prices
    items_total_dec: Optional[Decimal] = None
    if bill.items:
        item_sum = Decimal("0.00")
        has_items_with_price = False
        for item in bill.items:
            if item.total_price is not None:
                item_sum += Decimal(str(item.total_price))
                has_items_with_price = True
            elif item.unit_price is not None:
                qty = Decimal(str(item.quantity if item.quantity is not None else 1.0))
                item_sum += qty * Decimal(str(item.unit_price))
                has_items_with_price = True
        if has_items_with_price:
            items_total_dec = item_sum.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    items_total_float = float(items_total_dec) if items_total_dec is not None else None

    # Determine base subtotal
    subtotal_dec: Optional[Decimal] = None
    if bill.subtotal is not None:
        subtotal_dec = Decimal(str(bill.subtotal)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    elif items_total_dec is not None:
        subtotal_dec = items_total_dec

    # If subtotal or total is absent, cannot fully reconcile
    if bill.total is None or subtotal_dec is None:
        return BillValidationResult(
            is_consistent=True,
            difference=None,
            expected_total=float(subtotal_dec) if subtotal_dec is not None else None,
            items_total=items_total_float,
            message="Bill is missing subtotal or total; mathematical reconciliation check skipped.",
        )

    tax_dec = Decimal(str(bill.tax)) if bill.tax is not None else Decimal("0.00")
    tip_dec = Decimal(str(bill.tip)) if bill.tip is not None else Decimal("0.00")
    discount_dec = Decimal(str(bill.discount)) if bill.discount is not None else Decimal("0.00")
    actual_total_dec = Decimal(str(bill.total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    expected_total_dec = (subtotal_dec + tax_dec + tip_dec - discount_dec).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    diff_dec = (actual_total_dec - expected_total_dec).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    abs_diff_dec = abs(diff_dec)

    expected_total_float = float(expected_total_dec)
    diff_float = float(abs_diff_dec)

    if abs_diff_dec <= tolerance:
        return BillValidationResult(
            is_consistent=True,
            difference=0.0,
            expected_total=expected_total_float,
            items_total=items_total_float,
            message="Extracted subtotal, taxes, discounts, and total are mathematically consistent.",
        )
    else:
        return BillValidationResult(
            is_consistent=False,
            difference=diff_float,
            expected_total=expected_total_float,
            items_total=items_total_float,
            message=(
                f"Extracted subtotal ({float(subtotal_dec)}), tax ({float(tax_dec)}), "
                f"and total ({float(actual_total_dec)}) do not reconcile. "
                f"Expected {expected_total_float}, difference is {diff_float}."
            ),
        )


class BillParserError(Exception):
    """Base exception for bill parsing errors."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class BillParserConfigError(BillParserError):
    """Raised when Google Gemini API configuration is missing or invalid."""

    def __init__(self, message: str = "Google Gemini API key is not configured on the server."):
        super().__init__(code="MISSING_API_KEY", message=message)


class BillParserAPIError(BillParserError):
    """Raised when Gemini API call fails."""

    def __init__(self, message: str = "Failed to communicate with Gemini AI service."):
        super().__init__(code="GEMINI_API_ERROR", message=message)


class BillParserValidationError(BillParserError):
    """Raised when LLM output cannot be validated into target schema."""

    def __init__(self, message: str = "Extracted bill data failed schema validation."):
        super().__init__(code="BILL_EXTRACTION_FAILED", message=message)


class BillParserService:
    """Service for extracting and normalizing structured bill data using LangChain + Google Gemini LLM."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        llm: Optional[Any] = None,
        chain: Optional[Any] = None,
    ):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self._llm = llm
        self._chain = chain

    def _get_chain(self):
        """Construct the LangChain parsing chain."""
        if self._chain is not None:
            return self._chain

        if self._llm is not None:
            llm = self._llm
        else:
            current_api_key = self.api_key or os.getenv("GOOGLE_API_KEY")
            if not current_api_key or not current_api_key.strip():
                logger.error("Google Gemini API key is not set.")
                raise BillParserConfigError()

            model_name = self.model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=current_api_key.strip(),
                temperature=0.0,
            )

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", BILL_EXTRACTION_SYSTEM_PROMPT),
                (
                    "human",
                    "Extract structured bill information from this receipt OCR text:\n\n```text\n{ocr_text}\n```",
                ),
            ]
        )

        structured_llm = (
            llm.with_structured_output(Bill)
            if hasattr(llm, "with_structured_output")
            else llm
        )
        return prompt | structured_llm

    async def parse_bill(self, ocr_text: str) -> Bill:
        """
        Extract structured bill data from raw OCR text using LangChain + Gemini structured outputs.

        Args:
            ocr_text: Raw OCR text from receipt.

        Returns:
            Bill: Strongly validated Pydantic Bill object.

        Raises:
            BillParserConfigError: If Google Gemini API key is missing.
            BillParserAPIError: If Gemini API request fails.
            BillParserValidationError: If LLM output fails validation.
        """
        if not ocr_text or not ocr_text.strip():
            raise ValueError("OCR text must not be empty or whitespace only.")

        model_name = self.model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        logger.info("Invoking LangChain Bill Parser with Gemini model '%s'...", model_name)

        try:
            chain = self._get_chain()
            parsed_bill = await chain.ainvoke({"ocr_text": ocr_text.strip()})
        except BillParserConfigError:
            raise
        except ValueError as val_err:
            raise
        except Exception as exc:
            logger.error("LangChain Gemini parsing error: %s", str(exc), exc_info=True)
            raise BillParserAPIError(f"Gemini AI service returned an error during processing: {str(exc)}") from exc

        if parsed_bill is None:
            logger.error("Parsed bill object is missing from LangChain response.")
            raise BillParserValidationError("Failed to parse structured bill from model response.")

        if not isinstance(parsed_bill, Bill):
            try:
                if isinstance(parsed_bill, dict):
                    parsed_bill = Bill.model_validate(parsed_bill)
                else:
                    parsed_bill = Bill.model_validate(parsed_bill.model_dump())
            except Exception as val_err:
                logger.error("Validation error casting model output to Bill: %s", str(val_err))
                raise BillParserValidationError(f"Invalid bill structure: {str(val_err)}") from val_err

        logger.info(
            "Successfully extracted bill from merchant '%s' with %d items (Confidence: %s).",
            parsed_bill.merchant,
            len(parsed_bill.items),
            parsed_bill.confidence,
        )
        return parsed_bill


# Module-level singleton
_bill_parser_service: Optional[BillParserService] = None


def get_bill_parser_service() -> BillParserService:
    """Return singleton instance of BillParserService."""
    global _bill_parser_service
    if _bill_parser_service is None:
        _bill_parser_service = BillParserService()
    return _bill_parser_service

