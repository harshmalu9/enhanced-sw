import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pydantic import BaseModel
from langchain_core.prompts import ChatPromptTemplate

from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill, BillItem
from services.llm.base import BaseLLMProvider
from services.llm.exceptions import (
    LLMAllProvidersFailedError,
    LLMAuthenticationError,
    LLMConfigurationError,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from services.llm.gemini_provider import GeminiProvider
from services.llm.groq_provider import GroqProvider
from services.llm.mistral_provider import MistralProvider
from services.llm.router import LLMRouter, get_llm_router
from services.bill_parser import BillParserService
from services.bill_assignment import BillAssignmentService


class SimpleSchema(BaseModel):
    name: str
    amount: float


@pytest.fixture
def dummy_prompt():
    return ChatPromptTemplate.from_messages([("human", "Extract: {text}")])


# ==========================================
# 1. Provider Unit Tests
# ==========================================


def test_gemini_provider_configuration():
    provider_no_key = GeminiProvider(api_key="")
    assert not provider_no_key.is_configured()
    assert provider_no_key.name == "gemini"

    provider_with_key = GeminiProvider(api_key="valid-key", model="gemini-3.6-flash")
    assert provider_with_key.is_configured()
    assert provider_with_key.model == "gemini-3.6-flash"


def test_mistral_provider_configuration():
    provider_no_key = MistralProvider(api_key="")
    assert not provider_no_key.is_configured()
    assert provider_no_key.name == "mistral"

    provider_with_key = MistralProvider(api_key="valid-key", model="mistral-small-latest")
    assert provider_with_key.is_configured()
    assert provider_with_key.model == "mistral-small-latest"


def test_groq_provider_configuration():
    provider_no_key = GroqProvider(api_key="")
    assert not provider_no_key.is_configured()
    assert provider_no_key.name == "groq"
    assert provider_no_key.DEFAULT_MODEL == "openai/gpt-oss-20b"

    provider_default = GroqProvider(api_key="valid-key")
    assert provider_default.is_configured()
    assert provider_default.DEFAULT_MODEL == "openai/gpt-oss-20b"

    provider_custom = GroqProvider(api_key="valid-key", model="openai/gpt-oss-20b")
    assert provider_custom.is_configured()
    assert provider_custom.model == "openai/gpt-oss-20b"


# ==========================================
# 2. Exception Normalization Tests
# ==========================================


@pytest.mark.parametrize(
    "provider_cls",
    [GeminiProvider, MistralProvider, GroqProvider],
)
def test_exception_normalization_rate_limit(provider_cls):
    provider = provider_cls(api_key="test")
    err = provider.normalize_exception(Exception("HTTP 429: Resource has been exhausted (rate limit)"))
    assert isinstance(err, LLMRateLimitError)
    assert err.provider == provider.name


@pytest.mark.parametrize(
    "provider_cls",
    [GeminiProvider, MistralProvider, GroqProvider],
)
def test_exception_normalization_auth_error(provider_cls):
    provider = provider_cls(api_key="test")
    err = provider.normalize_exception(Exception("401 Unauthorized: Invalid API key"))
    assert isinstance(err, LLMAuthenticationError)


@pytest.mark.parametrize(
    "provider_cls",
    [GeminiProvider, MistralProvider, GroqProvider],
)
def test_exception_normalization_timeout(provider_cls):
    provider = provider_cls(api_key="test")
    err = provider.normalize_exception(Exception("Request timed out after 30000ms deadline exceeded"))
    assert isinstance(err, LLMTimeoutError)


@pytest.mark.parametrize(
    "provider_cls",
    [GeminiProvider, MistralProvider, GroqProvider],
)
def test_exception_normalization_unavailable(provider_cls):
    provider = provider_cls(api_key="test")
    err = provider.normalize_exception(Exception("503 Service Unavailable: High load"))
    assert isinstance(err, LLMUnavailableError)


# ==========================================
# 3. Router Tests
# ==========================================


def test_router_order_custom_and_env(monkeypatch):
    router = LLMRouter(provider_order=["groq", "mistral", "gemini"])
    assert router.get_order() == ["groq", "mistral", "gemini"]

    monkeypatch.setenv("LLM_PROVIDER_ORDER", "mistral, groq, gemini")
    router_env = LLMRouter()
    assert router_env.get_order() == ["mistral", "groq", "gemini"]

    monkeypatch.delenv("LLM_PROVIDER_ORDER", raising=False)
    router_default = LLMRouter()
    assert router_default.get_order() == ["gemini", "mistral", "groq"]


@pytest.mark.asyncio
async def test_router_no_configured_providers_raises_configuration_error(dummy_prompt):
    mock_p1 = MagicMock(spec=BaseLLMProvider)
    mock_p1.is_configured.return_value = False
    mock_p2 = MagicMock(spec=BaseLLMProvider)
    mock_p2.is_configured.return_value = False

    router = LLMRouter(
        providers={"gemini": mock_p1, "mistral": mock_p2},
        provider_order=["gemini", "mistral"],
    )

    with pytest.raises(LLMConfigurationError) as exc_info:
        await router.ainvoke_structured(
            prompt=dummy_prompt,
            schema=SimpleSchema,
            input_dict={"text": "hello"},
        )
    assert "No LLM providers are configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_router_primary_success(dummy_prompt):
    expected_output = SimpleSchema(name="Item A", amount=100.0)

    mock_gemini = MagicMock(spec=BaseLLMProvider)
    mock_gemini.name = "gemini"
    mock_gemini.is_configured.return_value = True
    mock_llm = MagicMock()
    mock_gemini.get_structured_llm.return_value = mock_llm

    mock_mistral = MagicMock(spec=BaseLLMProvider)
    mock_mistral.name = "mistral"
    mock_mistral.is_configured.return_value = True

    router = LLMRouter(
        providers={"gemini": mock_gemini, "mistral": mock_mistral},
        provider_order=["gemini", "mistral"],
    )

    with patch.object(ChatPromptTemplate, "__or__") as mock_chain_builder:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=expected_output)
        mock_chain_builder.return_value = mock_chain

        result, provider_used = await router.ainvoke_structured(
            prompt=dummy_prompt,
            schema=SimpleSchema,
            input_dict={"text": "test"},
        )

        assert result == expected_output
        assert provider_used == "gemini"
        # Verify secondary was never called
        assert not mock_mistral.get_structured_llm.called


@pytest.mark.asyncio
async def test_router_fallback_on_rate_limit(dummy_prompt):
    expected_output = SimpleSchema(name="Item Fallback", amount=250.0)

    # Gemini fails with 429 RateLimit
    mock_gemini = MagicMock(spec=BaseLLMProvider)
    mock_gemini.name = "gemini"
    mock_gemini.is_configured.return_value = True
    mock_gemini.normalize_exception.side_effect = lambda e: LLMRateLimitError("429 Quota Exceeded", "gemini")

    # Mistral succeeds
    mock_mistral = MagicMock(spec=BaseLLMProvider)
    mock_mistral.name = "mistral"
    mock_mistral.is_configured.return_value = True

    mock_gemini_llm = MagicMock()
    mock_mistral_llm = MagicMock()
    mock_gemini.get_structured_llm.return_value = mock_gemini_llm
    mock_mistral.get_structured_llm.return_value = mock_mistral_llm

    router = LLMRouter(
        providers={"gemini": mock_gemini, "mistral": mock_mistral},
        provider_order=["gemini", "mistral"],
    )

    call_count = 0

    async def mock_chain_invoke(input_dict):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Gemini attempt fails
            raise Exception("Rate limit reached 429")
        # Mistral attempt succeeds
        return expected_output

    with patch.object(ChatPromptTemplate, "__or__") as mock_chain_builder:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(side_effect=mock_chain_invoke)
        mock_chain_builder.return_value = mock_chain

        result, provider_used = await router.ainvoke_structured(
            prompt=dummy_prompt,
            schema=SimpleSchema,
            input_dict={"text": "test"},
        )

        assert result == expected_output
        assert provider_used == "mistral"
        assert call_count == 2


@pytest.mark.asyncio
async def test_router_multi_fallback_gemini_mistral_to_groq(dummy_prompt):
    expected_output = SimpleSchema(name="Groq Item", amount=300.0)

    # Gemini fails with 429
    mock_gemini = MagicMock(spec=BaseLLMProvider)
    mock_gemini.name = "gemini"
    mock_gemini.is_configured.return_value = True
    mock_gemini.normalize_exception.side_effect = lambda e: LLMRateLimitError("429 rate limit", "gemini")

    # Mistral fails with 503
    mock_mistral = MagicMock(spec=BaseLLMProvider)
    mock_mistral.name = "mistral"
    mock_mistral.is_configured.return_value = True
    mock_mistral.normalize_exception.side_effect = lambda e: LLMUnavailableError("503 overloaded", "mistral")

    # Groq succeeds
    mock_groq = MagicMock(spec=BaseLLMProvider)
    mock_groq.name = "groq"
    mock_groq.is_configured.return_value = True

    router = LLMRouter(
        providers={"gemini": mock_gemini, "mistral": mock_mistral, "groq": mock_groq},
        provider_order=["gemini", "mistral", "groq"],
    )

    call_count = 0

    async def mock_chain_invoke(input_dict):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Gemini 429")
        if call_count == 2:
            raise Exception("Mistral 503")
        return expected_output

    with patch.object(ChatPromptTemplate, "__or__") as mock_chain_builder:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(side_effect=mock_chain_invoke)
        mock_chain_builder.return_value = mock_chain

        result, provider_used = await router.ainvoke_structured(
            prompt=dummy_prompt,
            schema=SimpleSchema,
            input_dict={"text": "test"},
        )

        assert result == expected_output
        assert provider_used == "groq"
        assert call_count == 3


@pytest.mark.asyncio
async def test_router_all_providers_failed_raises_error(dummy_prompt):
    mock_gemini = MagicMock(spec=BaseLLMProvider)
    mock_gemini.name = "gemini"
    mock_gemini.is_configured.return_value = True
    mock_gemini.normalize_exception.side_effect = lambda e: LLMRateLimitError("Rate limit 429", "gemini")

    mock_mistral = MagicMock(spec=BaseLLMProvider)
    mock_mistral.name = "mistral"
    mock_mistral.is_configured.return_value = True
    mock_mistral.normalize_exception.side_effect = lambda e: LLMUnavailableError("Server error 500", "mistral")

    router = LLMRouter(
        providers={"gemini": mock_gemini, "mistral": mock_mistral},
        provider_order=["gemini", "mistral"],
    )

    with patch.object(ChatPromptTemplate, "__or__") as mock_chain_builder:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(side_effect=Exception("API failure"))
        mock_chain_builder.return_value = mock_chain

        with pytest.raises(LLMAllProvidersFailedError) as exc_info:
            await router.ainvoke_structured(
                prompt=dummy_prompt,
                schema=SimpleSchema,
                input_dict={"text": "test"},
            )

        assert "gemini" in exc_info.value.errors
        assert "mistral" in exc_info.value.errors


# ==========================================
# 4. End-to-End Service Fallback Tests
# ==========================================


@pytest.mark.asyncio
async def test_bill_parser_service_with_router_fallback():
    parsed_bill_mock = Bill(
        merchant="Test Cafe",
        items=[BillItem(name="Coffee", quantity=2, unit_price=100.0, total_price=200.0)],
        subtotal=200.0,
        tax=10.0,
        total=210.0,
        currency="INR",
    )

    mock_router = MagicMock(spec=LLMRouter)
    mock_router.ainvoke_structured = AsyncMock(return_value=(parsed_bill_mock, "mistral"))

    service = BillParserService(router=mock_router)
    bill = await service.parse_bill("Coffee 2 100 200 Total 210")

    assert bill.merchant == "Test Cafe"
    assert len(bill.items) == 1
    assert bill.total == 210.0
    mock_router.ainvoke_structured.assert_called_once()


@pytest.mark.asyncio
async def test_bill_assignment_service_with_router_fallback():
    sample_bill = Bill(
        merchant="Pizza Place",
        items=[BillItem(name="Pizza", quantity=1, total_price=300.0)],
        subtotal=300.0,
        total=300.0,
    )
    assignment_mock = BillAssignmentResult(
        assignments=[ItemAssignment(item_name="Pizza", people=["Alice", "Bob"])],
        unassigned_items=[],
        is_ambiguous=False,
    )

    mock_router = MagicMock(spec=LLMRouter)
    mock_router.ainvoke_structured = AsyncMock(return_value=(assignment_mock, "groq"))

    service = BillAssignmentService(router=mock_router)
    result = await service.assign_items(
        bill=sample_bill,
        people=["Alice", "Bob"],
        instruction="Alice and Bob shared the pizza",
    )

    assert len(result.assignments) == 1
    assert result.assignments[0].item_name == "Pizza"
    assert result.assignments[0].people == ["Alice", "Bob"]
    mock_router.ainvoke_structured.assert_called_once()
