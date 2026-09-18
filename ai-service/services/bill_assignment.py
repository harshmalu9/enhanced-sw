import logging
import os
from typing import Any, List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill

logger = logging.getLogger("enhanced-sw-ai.bill-assignment")

BILL_ASSIGNMENT_SYSTEM_PROMPT = """You are an expert bill item assignment assistant for expense sharing.
Your role is to analyze a natural language consumption instruction and map which people consumed which items from the receipt.

Input Context:
1. Valid participants ('people'): A strict list of names of people who participated in the meal/bill.
2. Bill Items ('bill_items'): The exact line items from the bill including names, quantities, and prices.
3. User instruction ('instruction'): Natural language text explaining who ate, drank, or shared which items.

Key Rules & Constraints:
1. Person Resolution:
   - Every person assigned MUST come strictly from the provided 'people' list.
   - Phrases like "all", "everyone", "all three", "all of us", "the whole group" MUST expand to every person in the provided 'people' list.
   - Phrases like "both" or "the two of them" should refer to the relevant pair mentioned in context.
   - Do NOT invent or include any person name not present in the 'people' list.

2. Item Matching & Natural Language Variations:
   - Match item mentions to the bill items based on names and context (e.g., "the margherita", "veg pizza", "the pizza" if only one pizza is on the bill).
   - Normalize the assigned 'item_name' to the exact item name from the bill items list.
   - Do NOT invent items that do not exist on the bill.

3. Quantities and Item-Level Shares:
   - If an item has quantity > 1 (e.g. 2 x Margherita Pizza) and the instruction explicitly separates them (e.g., "A had one pizza and B had one pizza"), populate 'quantity_shares' (e.g. {{"A": 1.0, "B": 1.0}}).
   - If multiple people shared the item equally, set 'people' to the list of participants and leave 'quantity_shares' as null.

4. Ambiguity Detection:
   - If the instruction is genuinely ambiguous and cannot be resolved reliably (e.g., "John had the pizza" when the bill has two different pizza items; or "Rahul had it" without a clear previous reference), set 'is_ambiguous' to true and provide an explanatory 'ambiguity_reason'.
   - Do NOT guess silently when multiple interpretations are equally plausible.

5. Unassigned Items:
   - Any bill item that is not mentioned or not consumed by anyone in the instruction should be listed in 'unassigned_items'.
"""


class BillAssignmentError(Exception):
    """Base exception for bill assignment errors."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class BillAssignmentConfigError(BillAssignmentError):
    """Raised when Google Gemini API key is not configured."""

    def __init__(self, message: str = "Google Gemini API key is not configured on the server."):
        super().__init__(code="MISSING_API_KEY", message=message)


class BillAssignmentAPIError(BillAssignmentError):
    """Raised when Gemini/LangChain API call fails."""

    def __init__(self, message: str = "Failed to communicate with Gemini AI service."):
        super().__init__(code="GEMINI_API_ERROR", message=message)


class BillAssignmentAmbiguityError(BillAssignmentError):
    """Raised when the user's natural language instruction is ambiguous."""

    def __init__(self, message: str):
        super().__init__(code="AMBIGUOUS_INSTRUCTION", message=message)


class BillAssignmentValidationError(BillAssignmentError):
    """Raised when LLM output violates person/item constraints."""

    def __init__(self, message: str):
        super().__init__(code="INVALID_ASSIGNMENT", message=message)


class BillAssignmentService:
    """Service for mapping natural language consumption instructions to structured item assignments using LangChain + Gemini."""

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
        """Construct the LangChain assignment chain."""
        if self._chain is not None:
            return self._chain

        if self._llm is not None:
            llm = self._llm
        else:
            current_api_key = self.api_key or os.getenv("GOOGLE_API_KEY")
            if not current_api_key or not current_api_key.strip():
                logger.error("Google Gemini API key is not set.")
                raise BillAssignmentConfigError()

            model_name = self.model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=current_api_key.strip(),
                temperature=0.0,
            )

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", BILL_ASSIGNMENT_SYSTEM_PROMPT),
                (
                    "human",
                    "Please assign the bill items to participants based on the user instruction.\n\n"
                    "Participants (people):\n{people}\n\n"
                    "Bill Items:\n{bill_items}\n\n"
                    "User Instruction:\n\"{instruction}\"",
                ),
            ]
        )

        structured_llm = (
            llm.with_structured_output(BillAssignmentResult)
            if hasattr(llm, "with_structured_output")
            else llm
        )
        return prompt | structured_llm

    async def assign_items(
        self,
        bill: Bill,
        people: List[str],
        instruction: str,
    ) -> BillAssignmentResult:
        """
        Map natural language consumption instructions to bill items and validate participants.

        Args:
            bill: Parsed Bill object.
            people: List of participant names.
            instruction: User consumption instruction string.

        Returns:
            BillAssignmentResult: Strongly validated structured assignment result.

        Raises:
            ValueError: If input arguments are empty or invalid.
            BillAssignmentConfigError: If Google Gemini API key is missing.
            BillAssignmentAmbiguityError: If instruction is ambiguous.
            BillAssignmentValidationError: If invalid people/items are referenced.
            BillAssignmentAPIError: If LLM call fails.
        """
        if not people or len(people) == 0:
            raise ValueError("People list must contain at least one participant name.")
        if not instruction or not instruction.strip():
            raise ValueError("Consumption instruction must not be empty or whitespace only.")
        if not bill.items or len(bill.items) == 0:
            raise ValueError("Bill must contain at least one line item to assign.")

        # Clean people list
        cleaned_people = [p.strip() for p in people if p and p.strip()]
        if not cleaned_people:
            raise ValueError("People list must contain non-empty participant names.")

        bill_items_dict = {item.name.lower(): item.name for item in bill.items}
        bill_items_desc = "\n".join(
            [
                f"- {item.name} (Qty: {item.quantity or 1}, Price: {item.total_price or item.unit_price or 'unknown'})"
                for item in bill.items
            ]
        )

        model_name = self.model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        logger.info("Invoking LangChain Bill Assignment with Gemini model '%s'...", model_name)

        try:
            chain = self._get_chain()
            result = await chain.ainvoke(
                {
                    "people": ", ".join(cleaned_people),
                    "bill_items": bill_items_desc,
                    "instruction": instruction.strip(),
                }
            )
        except BillAssignmentConfigError:
            raise
        except ValueError as val_err:
            raise
        except Exception as exc:
            logger.error("LangChain Gemini assignment error: %s", str(exc), exc_info=True)
            raise BillAssignmentAPIError(f"Gemini AI service returned an error: {str(exc)}") from exc

        if result is None:
            raise BillAssignmentAPIError("Failed to obtain structured assignment from Gemini model.")

        if not isinstance(result, BillAssignmentResult):
            try:
                if isinstance(result, dict):
                    result = BillAssignmentResult.model_validate(result)
                else:
                    result = BillAssignmentResult.model_validate(result.model_dump())
            except Exception as val_err:
                logger.error("Validation error casting model output to BillAssignmentResult: %s", str(val_err))
                raise BillAssignmentValidationError(f"Invalid assignment structure: {str(val_err)}") from val_err

        # 1. Check for Ambiguity
        if result.is_ambiguous:
            reason = result.ambiguity_reason or "The provided instruction is ambiguous and cannot be resolved reliably."
            logger.warning("Instruction marked as ambiguous: %s", reason)
            raise BillAssignmentAmbiguityError(reason)

        # 2. Deterministic Validation of People and Items
        normalized_assignments: List[ItemAssignment] = []
        assigned_canonical_item_names = set()

        for assign in result.assignments:
            # Validate and match item name to exact bill item
            matched_item_name = None
            assign_item_lower = assign.item_name.strip().lower()

            if assign_item_lower in bill_items_dict:
                matched_item_name = bill_items_dict[assign_item_lower]
            else:
                # Check for substring matching if exact match not found
                for bill_item_lower, bill_item_canonical in bill_items_dict.items():
                    if assign_item_lower in bill_item_lower or bill_item_lower in assign_item_lower:
                        matched_item_name = bill_item_canonical
                        break

            if not matched_item_name:
                logger.error("Assignment references unknown bill item: '%s'", assign.item_name)
                raise BillAssignmentValidationError(
                    f"Assignment referenced item '{assign.item_name}' which does not match any item on the bill."
                )

            # Validate all people in assignment
            valid_assigned_people = []
            for person in assign.people:
                clean_person = person.strip()
                # Exact or case-insensitive matching against people list
                matched_person = None
                for valid_p in cleaned_people:
                    if clean_person.lower() == valid_p.lower():
                        matched_person = valid_p
                        break

                if not matched_person:
                    logger.error("Assignment references unknown participant: '%s'", person)
                    raise BillAssignmentValidationError(
                        f"Assignment referenced participant '{person}' who is not in the participants list ({', '.join(cleaned_people)})."
                    )
                valid_assigned_people.append(matched_person)

            # Validate quantity shares if provided
            valid_qty_shares = None
            if assign.quantity_shares:
                valid_qty_shares = {}
                for p_name, qty in assign.quantity_shares.items():
                    matched_p = None
                    for valid_p in cleaned_people:
                        if p_name.strip().lower() == valid_p.lower():
                            matched_p = valid_p
                            break
                    if not matched_p:
                        raise BillAssignmentValidationError(
                            f"Quantity share referenced unknown participant '{p_name}'."
                        )
                    valid_qty_shares[matched_p] = float(qty)

            if len(valid_assigned_people) > 0:
                assigned_canonical_item_names.add(matched_item_name)
                normalized_assignments.append(
                    ItemAssignment(
                        item_name=matched_item_name,
                        people=valid_assigned_people,
                        quantity_shares=valid_qty_shares,
                    )
                )

        # 3. Deterministically compute unassigned items
        all_bill_item_names = [item.name for item in bill.items]
        unassigned = [
            item_name
            for item_name in all_bill_item_names
            if item_name not in assigned_canonical_item_names
        ]

        validated_result = BillAssignmentResult(
            assignments=normalized_assignments,
            unassigned_items=unassigned,
            is_ambiguous=False,
            ambiguity_reason=None,
        )

        logger.info(
            "Successfully assigned %d items among %d people (%d unassigned items).",
            len(validated_result.assignments),
            len(cleaned_people),
            len(unassigned),
        )
        return validated_result


# Module-level singleton
_bill_assignment_service: Optional[BillAssignmentService] = None


def get_bill_assignment_service() -> BillAssignmentService:
    """Return singleton instance of BillAssignmentService."""
    global _bill_assignment_service
    if _bill_assignment_service is None:
        _bill_assignment_service = BillAssignmentService()
    return _bill_assignment_service
