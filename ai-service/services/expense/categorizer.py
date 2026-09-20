import logging
import os
from typing import Any, Optional
from langchain_core.prompts import ChatPromptTemplate
from services.expense.prompts import get_expense_categorization_prompt
from services.expense.schemas import (
    EXPENSE_CATEGORIES,
    EXPENSE_CATEGORIES_SET,
    VALID_CONFIDENCE_LEVELS,
    ExpenseCategorizationData,
    ExpenseCategoryLLMOutput,
)
from services.llm import (
    LLMAllProvidersFailedError,
    LLMConfigurationError,
    LLMProviderError,
    LLMRouter,
    get_llm_router,
)

logger = logging.getLogger("enhanced-sw-ai.expense-categorizer")


class ExpenseCategorizationError(Exception):
    """Base exception for expense categorization errors."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class ExpenseCategorizationConfigError(ExpenseCategorizationError):
    """Raised when no LLM providers are configured with valid API keys."""

    def __init__(self, message: str = "LLM API key is not configured on the server."):
        super().__init__(code="MISSING_API_KEY", message=message)


class ExpenseCategorizationAPIError(ExpenseCategorizationError):
    """Raised when LLM API call fails across all providers."""

    def __init__(
        self,
        message: str = "Failed to communicate with LLM AI service.",
        code: str = "LLM_PROVIDER_ERROR",
    ):
        super().__init__(code=code, message=message)


class ExpenseCategorizationValidationError(ExpenseCategorizationError):
    """Raised when LLM output violates category or confidence constraints."""

    def __init__(self, message: str):
        super().__init__(code="INVALID_CATEGORIZATION", message=message)


class ExpenseCategorizerService:
    """
    Dedicated expense categorization service using LangChain structured output
    and the multi-provider LLM router (Gemini -> Mistral -> Groq).
    """

    def __init__(
        self,
        router: Optional[LLMRouter] = None,
        chain: Optional[Any] = None,
        llm: Optional[Any] = None,
    ):
        self.router = router or get_llm_router()
        self._chain = chain
        self._llm = llm

    def _get_chain(self):
        """Construct custom LangChain execution chain if llm or chain was injected."""
        if self._chain is not None:
            return self._chain
        if self._llm is not None:
            prompt = get_expense_categorization_prompt()
            structured_llm = (
                self._llm.with_structured_output(ExpenseCategoryLLMOutput)
                if hasattr(self._llm, "with_structured_output")
                else self._llm
            )
            return prompt | structured_llm
        return None

    async def categorize_expense(
        self,
        description: str,
        amount: Optional[float] = None,
        merchant: Optional[str] = None,
    ) -> ExpenseCategorizationData:
        """
        Categorize an expense description into one canonical category with a confidence level.

        Args:
            description: Description of the expense (required, non-empty).
            amount: Optional monetary amount.
            merchant: Optional merchant or vendor name.

        Returns:
            ExpenseCategorizationData: Validated category and confidence.

        Raises:
            ValueError: If input validation fails (e.g. empty description or negative amount).
            ExpenseCategorizationConfigError: If no LLM providers are configured.
            ExpenseCategorizationValidationError: If LLM output fails deterministic validation.
            ExpenseCategorizationAPIError: If LLM call fails across providers.
        """
        # 1. Deterministic Input Validation
        if not description or not isinstance(description, str) or not description.strip():
            raise ValueError("Expense description must not be empty or whitespace only.")

        clean_description = description.strip()

        if amount is not None:
            if not isinstance(amount, (int, float)) or amount < 0:
                raise ValueError("Expense amount must be a non-negative number.")

        clean_merchant = merchant.strip() if merchant and isinstance(merchant, str) and merchant.strip() else None

        # 2. Prepare Prompt Input
        prompt = get_expense_categorization_prompt()
        input_dict = {
            "description": clean_description,
            "amount": f"{amount:.2f}" if amount is not None else "Not specified",
            "merchant": clean_merchant if clean_merchant else "Not specified",
        }

        # 3. LLM Router / Chain Execution
        try:
            custom_chain = self._get_chain()
            if custom_chain is not None:
                result = await custom_chain.ainvoke(input_dict)
                provider_used = "custom"
            else:
                result, provider_used = await self.router.ainvoke_structured(
                    prompt=prompt,
                    schema=ExpenseCategoryLLMOutput,
                    input_dict=input_dict,
                    temperature=0.0,
                )
        except LLMConfigurationError as cfg_err:
            logger.error("LLM configuration error during categorization: %s", str(cfg_err))
            raise ExpenseCategorizationConfigError(str(cfg_err)) from cfg_err
        except (LLMProviderError, LLMAllProvidersFailedError) as api_err:
            logger.error("LLM categorization failed across providers: %s", str(api_err))
            raise ExpenseCategorizationAPIError(str(api_err)) from api_err
        except (ValueError, ExpenseCategorizationError):
            raise
        except Exception as exc:
            logger.error("Unhandled error during expense categorization: %s", str(exc), exc_info=True)
            raise ExpenseCategorizationAPIError(
                f"LLM service returned an error during categorization: {str(exc)}"
            ) from exc

        if result is None:
            raise ExpenseCategorizationAPIError("LLM provider returned empty response payload.")

        # 4. Normalize Raw Output
        raw_category = getattr(result, "category", None)
        raw_confidence = getattr(result, "confidence", None)

        if raw_category is None and isinstance(result, dict):
            raw_category = result.get("category")
            raw_confidence = result.get("confidence")

        if not raw_category or not isinstance(raw_category, str):
            raise ExpenseCategorizationValidationError(
                f"LLM did not return a valid category string. Received: {raw_category}"
            )

        if not raw_confidence or not isinstance(raw_confidence, str):
            raise ExpenseCategorizationValidationError(
                f"LLM did not return a valid confidence string. Received: {raw_confidence}"
            )

        clean_category = raw_category.strip()
        clean_confidence = raw_confidence.strip().lower()

        # 5. Deterministic Validation of Category against Canonical Set
        # Case-insensitive matching to canonical category names
        matched_category: Optional[str] = None
        for canonical_cat in EXPENSE_CATEGORIES:
            if clean_category.lower() == canonical_cat.lower():
                matched_category = canonical_cat
                break

        if not matched_category:
            logger.warning(
                "LLM returned non-canonical category: '%s'. Allowed: %s",
                clean_category,
                EXPENSE_CATEGORIES,
            )
            raise ExpenseCategorizationValidationError(
                f"Invalid category '{clean_category}' returned by LLM. Must be one of: {', '.join(EXPENSE_CATEGORIES)}"
            )

        # 6. Deterministic Validation of Confidence
        if clean_confidence not in VALID_CONFIDENCE_LEVELS:
            logger.warning(
                "LLM returned invalid confidence level: '%s'. Allowed: %s",
                clean_confidence,
                VALID_CONFIDENCE_LEVELS,
            )
            raise ExpenseCategorizationValidationError(
                f"Invalid confidence '{clean_confidence}' returned by LLM. Must be one of: high, medium, low"
            )

        logger.info(
            "Categorized expense '%s' -> %s (%s confidence) using provider '%s'",
            clean_description[:30],
            matched_category,
            clean_confidence,
            provider_used,
        )

        return ExpenseCategorizationData(
            category=matched_category,
            confidence=clean_confidence,
        )


# Module-level singleton
_expense_categorizer_service: Optional[ExpenseCategorizerService] = None


def get_expense_categorizer_service() -> ExpenseCategorizerService:
    """Return singleton instance of ExpenseCategorizerService."""
    global _expense_categorizer_service
    if _expense_categorizer_service is None:
        _expense_categorizer_service = ExpenseCategorizerService()
    return _expense_categorizer_service
