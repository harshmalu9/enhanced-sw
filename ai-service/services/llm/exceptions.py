from typing import Optional


class LLMProviderError(Exception):
    """Base exception for all LLM provider errors."""

    def __init__(
        self,
        message: str,
        provider: str = "unknown",
        code: str = "LLM_PROVIDER_ERROR",
        status_code: int = 502,
    ):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.code = code
        self.status_code = status_code


class LLMRateLimitError(LLMProviderError):
    """Raised when a provider returns HTTP 429 / Rate limit / Quota exceeded."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            code="LLM_RATE_LIMIT",
            status_code=429,
        )


class LLMAuthenticationError(LLMProviderError):
    """Raised when provider authentication fails (401 / 403 / invalid key)."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            code="LLM_AUTH_ERROR",
            status_code=503,
        )


class LLMTimeoutError(LLMProviderError):
    """Raised when provider API call times out."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            code="LLM_TIMEOUT",
            status_code=504,
        )


class LLMUnavailableError(LLMProviderError):
    """Raised when provider service is down / 5xx / network connection failure."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            code="LLM_UNAVAILABLE",
            status_code=502,
        )


class LLMConfigurationError(LLMProviderError):
    """Raised when a provider is not configured or missing API keys."""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=message,
            provider=provider,
            code="MISSING_API_KEY",
            status_code=503,
        )


class LLMAllProvidersFailedError(LLMProviderError):
    """Raised when all attempted fallback providers fail."""

    def __init__(
        self,
        message: str = "All configured LLM providers failed to process the request.",
        errors: Optional[dict] = None,
    ):
        super().__init__(
            message=message,
            provider="router",
            code="ALL_LLM_PROVIDERS_FAILED",
            status_code=502,
        )
        self.errors = errors or {}
