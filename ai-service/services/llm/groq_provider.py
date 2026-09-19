import os
from typing import Any, Optional, Type
from pydantic import BaseModel
from langchain_groq import ChatGroq
from services.llm.base import BaseLLMProvider
from services.llm.exceptions import LLMConfigurationError


class GroqProvider(BaseLLMProvider):
    """Groq provider implementation via LangChain."""

    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        super().__init__(name="groq", api_key=api_key, model=model)

    def is_configured(self) -> bool:
        key = self.api_key if self.api_key is not None else os.getenv("GROQ_API_KEY")
        return bool(key and key.strip() and not key.startswith("your_") and key != "fake_key")

    def get_structured_llm(self, schema: Type[BaseModel], temperature: float = 0.0) -> Any:
        if not self.is_configured():
            raise LLMConfigurationError(
                message="Groq API key (GROQ_API_KEY) is not configured.",
                provider=self.name,
            )

        key = (self.api_key if self.api_key is not None else os.getenv("GROQ_API_KEY", "")).strip()
        model_name = self.model or os.getenv("GROQ_MODEL", self.DEFAULT_MODEL)

        llm = ChatGroq(
            model=model_name,
            groq_api_key=key,
            temperature=temperature,
        )

        return (
            llm.with_structured_output(schema)
            if hasattr(llm, "with_structured_output")
            else llm
        )
