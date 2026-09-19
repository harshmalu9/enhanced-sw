from abc import ABC, abstractmethod
from typing import Any, Optional, Type
from pydantic import BaseModel
from services.llm.exceptions import (
    LLMAuthenticationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)


class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers in the fallback architecture."""

    def __init__(self, name: str, api_key: Optional[str] = None, model: Optional[str] = None):
        self.name = name
        self.api_key = api_key
        self.model = model

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if the provider has valid API credentials configured."""
        pass

    @abstractmethod
    def get_structured_llm(self, schema: Type[BaseModel], temperature: float = 0.0) -> Any:
        """Return a LangChain model runnable configured for structured output."""
        pass

    def normalize_exception(self, exc: Exception) -> LLMProviderError:
        """Map provider-specific exceptions to normalized LLMProviderError hierarchy."""
        exc_str = str(exc).lower()

        # Rate limits & Quota
        if "429" in exc_str or "rate limit" in exc_str or "quota" in exc_str or "resource_exhausted" in exc_str:
            return LLMRateLimitError(
                message=f"Rate limit or quota exceeded on {self.name}: {str(exc)}",
                provider=self.name,
            )

        # Authentication errors
        if "401" in exc_str or "403" in exc_str or "invalid api key" in exc_str or "unauthorized" in exc_str or "authentication" in exc_str:
            return LLMAuthenticationError(
                message=f"Authentication error on {self.name}: {str(exc)}",
                provider=self.name,
            )

        # Timeouts
        if "timeout" in exc_str or "timed out" in exc_str or "deadline" in exc_str:
            return LLMTimeoutError(
                message=f"Timeout communicating with {self.name}: {str(exc)}",
                provider=self.name,
            )

        # Service unavailable / 5xx
        if any(code in exc_str for code in ["500", "502", "503", "504", "unavailable", "server error", "connection"]):
            return LLMUnavailableError(
                message=f"Service unavailable error on {self.name}: {str(exc)}",
                provider=self.name,
            )

        return LLMProviderError(
            message=f"Provider {self.name} error: {str(exc)}",
            provider=self.name,
        )
