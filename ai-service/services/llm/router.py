import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Type
from pydantic import BaseModel
from langchain_core.prompts import ChatPromptTemplate
from services.llm.base import BaseLLMProvider
from services.llm.exceptions import (
    LLMAllProvidersFailedError,
    LLMConfigurationError,
    LLMProviderError,
)
from services.llm.gemini_provider import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.mistral_provider import MistralProvider

logger = logging.getLogger("enhanced-sw-ai.llm-router")


class LLMRouter:
    """
    Manages multi-provider LLM fallback execution across Gemini, Mistral, and Groq.
    Executes providers sequentially according to configured order until a successful
    response is obtained.
    """

    DEFAULT_ORDER = ["gemini", "mistral", "groq"]

    def __init__(
        self,
        providers: Optional[Dict[str, BaseLLMProvider]] = None,
        provider_order: Optional[List[str]] = None,
    ):
        if providers is not None:
            self.providers = providers
        else:
            self.providers = {
                "gemini": GeminiProvider(),
                "mistral": MistralProvider(),
                "groq": GroqProvider(),
            }
        self._custom_order = provider_order

    def get_order(self) -> List[str]:
        """Return the prioritized list of provider names to attempt."""
        if self._custom_order:
            return self._custom_order

        order_str = os.getenv("LLM_PROVIDER_ORDER", "")
        if order_str and order_str.strip():
            return [p.strip().lower() for p in order_str.split(",") if p.strip()]
        return self.DEFAULT_ORDER

    async def ainvoke_structured(
        self,
        prompt: ChatPromptTemplate,
        schema: Type[BaseModel],
        input_dict: dict,
        temperature: float = 0.0,
    ) -> Tuple[Any, str]:
        """
        Execute structured extraction chain with sequential provider fallback.

        Args:
            prompt: LangChain ChatPromptTemplate.
            schema: Target Pydantic model for structured output.
            input_dict: Dictionary of prompt input variables.
            temperature: Sampling temperature (defaults to 0.0 for deterministic extraction).

        Returns:
            Tuple[Any, str]: (Extracted structured Pydantic object, Provider name that succeeded)

        Raises:
            LLMConfigurationError: If no providers have API keys configured.
            LLMAllProvidersFailedError: If all configured providers fail.
        """
        order = self.get_order()
        attempted_errors: Dict[str, str] = {}
        configured_count = 0

        for provider_name in order:
            provider = self.providers.get(provider_name)
            if not provider:
                logger.debug("Provider '%s' in order list is not recognized; skipping.", provider_name)
                continue

            if not provider.is_configured():
                logger.debug("Provider '%s' is not configured (missing API key); skipping.", provider_name)
                continue

            configured_count += 1
            logger.info("LLM provider attempt: %s", provider_name)

            try:
                structured_llm = provider.get_structured_llm(schema=schema, temperature=temperature)
                chain = prompt | structured_llm
                result = await chain.ainvoke(input_dict)

                if result is None:
                    raise LLMProviderError(
                        message="Provider returned null response payload.",
                        provider=provider_name,
                    )

                logger.info("LLM provider succeeded: %s", provider_name)
                return result, provider_name

            except Exception as exc:
                normalized_err = provider.normalize_exception(exc)
                attempted_errors[provider_name] = f"{type(normalized_err).__name__}: {str(normalized_err)}"
                logger.warning(
                    "LLM provider failed: %s (%s). Falling back to next available provider...",
                    provider_name,
                    type(normalized_err).__name__,
                )

        if configured_count == 0:
            logger.error("No LLM providers are configured with valid API keys.")
            raise LLMConfigurationError(
                message="No LLM providers are configured. Please set GOOGLE_API_KEY, MISTRAL_API_KEY, or GROQ_API_KEY in .env."
            )

        error_summary = "; ".join(f"{p}: {err}" for p, err in attempted_errors.items())
        logger.error("All configured LLM providers failed: %s", error_summary)
        raise LLMAllProvidersFailedError(
            message=f"All configured LLM providers failed to process the request: {error_summary}",
            errors=attempted_errors,
        )


# Module-level singleton
_llm_router: Optional[LLMRouter] = None


def get_llm_router() -> LLMRouter:
    """Return singleton instance of LLMRouter."""
    global _llm_router
    if _llm_router is None:
        _llm_router = LLMRouter()
    return _llm_router
