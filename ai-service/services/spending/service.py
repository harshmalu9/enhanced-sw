import json
import logging
from typing import Any, List, Optional

from services.llm import (
    LLMAllProvidersFailedError,
    LLMConfigurationError,
    LLMProviderError,
    LLMRouter,
    get_llm_router,
)
from services.spending.analyzer import SpendingAnalyzer
from services.spending.prompts import get_spending_insights_prompt
from services.spending.schemas import (
    ExpenseItem,
    PeriodInfo,
    SpendingInsightsData,
    SpendingInsightsLLMOutput,
    SpendingSummary,
)

logger = logging.getLogger("enhanced-sw-ai.spending-insights")


class SpendingInsightsError(Exception):
    """Base exception for spending insights errors."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class SpendingInsightsConfigError(SpendingInsightsError):
    """Raised when no LLM providers are configured with valid API keys."""

    def __init__(self, message: str = "LLM API key is not configured on the server."):
        super().__init__(code="MISSING_API_KEY", message=message)


class SpendingInsightsAPIError(SpendingInsightsError):
    """Raised when LLM API call fails across all fallback providers."""

    def __init__(
        self,
        message: str = "Failed to communicate with LLM AI service.",
        code: str = "LLM_PROVIDER_ERROR",
    ):
        super().__init__(code=code, message=message)


class SpendingInsightsValidationError(SpendingInsightsError):
    """Raised when LLM output violates schema or structure constraints."""

    def __init__(self, message: str):
        super().__init__(code="INVALID_INSIGHTS", message=message)


class SpendingInsightsService:
    """
    Orchestrates deterministic spending analysis and LangChain-powered
    insight generation via the multi-provider LLM router.
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
            prompt = get_spending_insights_prompt()
            structured_llm = (
                self._llm.with_structured_output(SpendingInsightsLLMOutput)
                if hasattr(self._llm, "with_structured_output")
                else self._llm
            )
            return prompt | structured_llm
        return None

    async def generate_insights(
        self,
        expenses: List[ExpenseItem],
        period: Optional[PeriodInfo] = None,
    ) -> SpendingInsightsData:
        """
        Analyze expenses deterministically and generate grounded natural-language insights.

        Args:
            expenses: List of validated ExpenseItem instances.
            period: Optional period metadata (start and end dates).

        Returns:
            SpendingInsightsData: Summary statistics and AI insights.

        Raises:
            SpendingInsightsConfigError: If LLM API credentials are not configured.
            SpendingInsightsValidationError: If LLM output violates schema.
            SpendingInsightsAPIError: If LLM communication fails.
        """
        # 1. Deterministic summary calculation
        summary: SpendingSummary = SpendingAnalyzer.analyze(expenses)

        # 2. Fast return on empty expense list (DO NOT call LLM)
        if not expenses or summary.expense_count == 0:
            logger.info("Empty expenses list provided. Returning empty summary without LLM call.")
            return SpendingInsightsData(
                summary=summary,
                insights=[],
                period=period,
            )

        # 3. Format statistics for LLM prompt input
        period_str = (
            f"{period.start} to {period.end}"
            if period and period.start and period.end
            else (period.start or period.end or "Not specified")
            if period
            else "Not specified"
        )

        top_cat_str = (
            f"{summary.highest_spending_category.category} (₹{summary.highest_spending_category.amount:,.2f}, {summary.highest_spending_category.percentage}%)"
            if summary.highest_spending_category
            else "None"
        )

        largest_exp_str = (
            f"'{summary.largest_expense.description}' for ₹{summary.largest_expense.amount:,.2f} ({summary.largest_expense.category}"
            + (f", Merchant: {summary.largest_expense.merchant})" if summary.largest_expense.merchant else ")")
            if summary.largest_expense
            else "None"
        )

        prompt_input = {
            "total_spending": f"{summary.total_spending:,.2f}",
            "expense_count": summary.expense_count,
            "average_expense": f"{summary.average_expense:,.2f}",
            "spending_by_category": json.dumps(summary.spending_by_category),
            "category_percentages": json.dumps(summary.category_percentages),
            "highest_spending_category": top_cat_str,
            "largest_expense": largest_exp_str,
            "period": period_str,
        }

        # 4. Invoke LLM structured generation
        try:
            custom_chain = self._get_chain()
            if custom_chain is not None:
                result = await custom_chain.ainvoke(prompt_input)
                provider_used = "custom"
            else:
                prompt = get_spending_insights_prompt()
                result, provider_used = await self.router.ainvoke_structured(
                    prompt=prompt,
                    schema=SpendingInsightsLLMOutput,
                    input_dict=prompt_input,
                    temperature=0.0,
                )
        except LLMConfigurationError as cfg_err:
            logger.error("LLM configuration error during spending insights: %s", str(cfg_err))
            raise SpendingInsightsConfigError(str(cfg_err)) from cfg_err
        except (LLMProviderError, LLMAllProvidersFailedError) as api_err:
            logger.error("LLM spending insights failed across providers: %s", str(api_err))
            raise SpendingInsightsAPIError(str(api_err)) from api_err
        except Exception as exc:
            logger.error("Unhandled error during spending insights generation: %s", str(exc), exc_info=True)
            raise SpendingInsightsAPIError(
                f"LLM service returned an error during insights generation: {str(exc)}"
            ) from exc

        if result is None:
            raise SpendingInsightsAPIError("LLM provider returned empty response payload.")

        # 5. Deterministic validation of LLM insights
        raw_insights = getattr(result, "insights", None)
        if raw_insights is None and isinstance(result, dict):
            raw_insights = result.get("insights")

        if not isinstance(raw_insights, list):
            raise SpendingInsightsValidationError(
                f"LLM output 'insights' must be a list. Received: {type(raw_insights)}"
            )

        cleaned_insights = [
            str(item).strip() for item in raw_insights if item and str(item).strip()
        ]

        if not cleaned_insights:
            raise SpendingInsightsValidationError("LLM returned an empty list of insights.")

        logger.info(
            "Generated %d spending insights across %d expenses using provider '%s'",
            len(cleaned_insights),
            len(expenses),
            provider_used,
        )

        return SpendingInsightsData(
            summary=summary,
            insights=cleaned_insights,
            period=period,
        )


# Module-level singleton
_spending_insights_service: Optional[SpendingInsightsService] = None


def get_spending_insights_service() -> SpendingInsightsService:
    """Return singleton instance of SpendingInsightsService."""
    global _spending_insights_service
    if _spending_insights_service is None:
        _spending_insights_service = SpendingInsightsService()
    return _spending_insights_service
