import pytest
from langchain_core.runnables import RunnableLambda
from models.bill import Bill, BillItem
from services.bill_parser import (
    BillParserAPIError,
    BillParserConfigError,
    BillParserService,
    BillParserValidationError,
)


@pytest.mark.asyncio
async def test_bill_parser_valid_ocr():
    ocr_text = """DOMINOSPIZZAE
Margherita Pizza 299
Farmhouse Pizza 399
Coke
80
Subtotal
778
GST
3
Total
817"""

    expected_bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, unit_price=299.0, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, unit_price=399.0, total_price=399.0),
            BillItem(name="Coke", quantity=1, unit_price=80.0, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        discount=None,
        total=817.0,
        currency="INR",
        confidence="high",
    )

    mock_chain = RunnableLambda(lambda x: expected_bill)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    result = await service.parse_bill(ocr_text)

    assert result.merchant == "Domino's Pizza"
    assert len(result.items) == 3
    assert result.items[0].name == "Margherita Pizza"
    assert result.items[0].total_price == 299.0
    assert result.items[1].name == "Farmhouse Pizza"
    assert result.items[1].total_price == 399.0
    assert result.items[2].name == "Coke"
    assert result.items[2].total_price == 80.0
    assert result.subtotal == 778.0
    assert result.tax == 3.0
    assert result.discount is None
    assert result.total == 817.0
    assert result.currency == "INR"
    assert result.confidence == "high"


@pytest.mark.asyncio
async def test_bill_parser_messy_ocr():
    messy_text = """DOMINOSPIZZAE
Margherita Pizza299
Farmhouse Pizza
399
Coke
80
Subtotal
778
GST
3
Total
817"""

    expected_bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, unit_price=299.0, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, unit_price=399.0, total_price=399.0),
            BillItem(name="Coke", quantity=1, unit_price=80.0, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        discount=None,
        total=817.0,
        currency="INR",
        confidence="medium",
    )

    mock_chain = RunnableLambda(lambda x: expected_bill)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    result = await service.parse_bill(messy_text)

    assert result.merchant == "Domino's Pizza"
    assert len(result.items) == 3
    assert result.total == 817.0


@pytest.mark.asyncio
async def test_bill_parser_missing_data_no_hallucination():
    sparse_text = """Margherita Pizza 299
Coke 80"""

    expected_bill = Bill(
        merchant=None,
        items=[
            BillItem(name="Margherita Pizza", quantity=1, unit_price=299.0, total_price=299.0),
            BillItem(name="Coke", quantity=1, unit_price=80.0, total_price=80.0),
        ],
        subtotal=None,
        tax=None,
        discount=None,
        tip=None,
        total=None,
        currency="INR",
        confidence="medium",
    )

    mock_chain = RunnableLambda(lambda x: expected_bill)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    result = await service.parse_bill(sparse_text)

    assert result.merchant is None
    assert result.subtotal is None
    assert result.tax is None
    assert result.discount is None
    assert result.total is None
    assert len(result.items) == 2


@pytest.mark.asyncio
async def test_bill_parser_empty_text_raises_value_error():
    service = BillParserService(api_key="test-key")
    with pytest.raises(ValueError, match="must not be empty"):
        await service.parse_bill("   \n  \t  ")


@pytest.mark.asyncio
async def test_bill_parser_missing_api_key_raises_config_error(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    service = BillParserService(api_key=None, llm=None, chain=None)
    with pytest.raises(BillParserConfigError) as exc_info:
        await service.parse_bill("Valid OCR text")
    assert exc_info.value.code == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_bill_parser_api_error_handling():
    def raise_err(_):
        raise RuntimeError("LangChain Gemini API timeout")

    mock_chain = RunnableLambda(raise_err)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillParserAPIError) as exc_info:
        await service.parse_bill("Some receipt text")
    assert exc_info.value.code == "GEMINI_API_ERROR"


@pytest.mark.asyncio
async def test_bill_parser_none_result_raises_validation_error():
    mock_chain = RunnableLambda(lambda x: None)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillParserValidationError):
        await service.parse_bill("Some receipt text")


def test_bill_parser_gemini_initialization_and_structured_output(monkeypatch):
    from unittest.mock import MagicMock, patch

    monkeypatch.setenv("GOOGLE_API_KEY", "test-env-gemini-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.6-flash")

    with patch("services.bill_parser.ChatGoogleGenerativeAI") as mock_gemini_cls:
        mock_llm_instance = MagicMock()
        mock_structured_llm = MagicMock()
        mock_llm_instance.with_structured_output.return_value = mock_structured_llm
        mock_gemini_cls.return_value = mock_llm_instance

        service = BillParserService()
        chain = service._get_chain()

        mock_gemini_cls.assert_called_once_with(
            model="gemini-3.6-flash",
            google_api_key="test-env-gemini-key",
            temperature=0.0,
        )
        mock_llm_instance.with_structured_output.assert_called_once_with(Bill)


def test_validate_bill_consistency_consistent():
    from services.bill_parser import validate_bill_consistency

    bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", total_price=299.0),
            BillItem(name="Farmhouse Pizza", total_price=399.0),
            BillItem(name="Coke", total_price=80.0),
        ],
        subtotal=778.0,
        tax=39.0,
        total=817.0,
    )
    val = validate_bill_consistency(bill)
    assert val.is_consistent is True
    assert val.difference == 0.0
    assert val.expected_total == 817.0
    assert val.items_total == 778.0


def test_validate_bill_consistency_inconsistent_explicit_tax():
    from services.bill_parser import validate_bill_consistency

    # Regression case: OCR explicitly gave GST = 3, subtotal = 778, total = 817
    # Expected total = 778 + 3 = 781 != 817 (difference = 36)
    bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", total_price=299.0),
            BillItem(name="Farmhouse Pizza", total_price=399.0),
            BillItem(name="Coke", total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        total=817.0,
    )
    val = validate_bill_consistency(bill)
    assert val.is_consistent is False
    assert val.difference == 36.0
    assert val.expected_total == 781.0
    assert "do not reconcile" in val.message
    # Assert tax remained 3.0, not silently changed
    assert bill.tax == 3.0


def test_validate_bill_consistency_with_discount_and_tip():
    from services.bill_parser import validate_bill_consistency

    bill = Bill(
        items=[BillItem(name="Meal", total_price=1000.0)],
        subtotal=1000.0,
        tax=100.0,
        tip=50.0,
        discount=150.0,
        total=1000.0,
    )
    # 1000 + 100 + 50 - 150 = 1000.0
    val = validate_bill_consistency(bill)
    assert val.is_consistent is True
    assert val.difference == 0.0
    assert val.expected_total == 1000.0


def test_validate_bill_consistency_missing_fields():
    from services.bill_parser import validate_bill_consistency

    # Total or subtotal missing
    bill_no_total = Bill(
        items=[BillItem(name="Pizza", total_price=300.0)],
        subtotal=300.0,
        total=None,
    )
    val = validate_bill_consistency(bill_no_total)
    assert val.is_consistent is True
    assert val.difference is None

    # Only items present, no subtotal field
    bill_no_subtotal = Bill(
        items=[
            BillItem(name="Pizza", total_price=300.0),
            BillItem(name="Drink", total_price=50.0),
        ],
        tax=20.0,
        total=370.0,
    )
    val2 = validate_bill_consistency(bill_no_subtotal)
    assert val2.is_consistent is True
    assert val2.items_total == 350.0
    assert val2.expected_total == 370.0
    assert val2.difference == 0.0


@pytest.mark.asyncio
async def test_bill_parser_regression_ocr_gst_preserved():
    ocr_text = """DOMINOSPIZZAE
Margherita Pizza 299
Farmhouse Pizza 399
Coke
80
Subtotal
778
GST
3
Total
817"""

    # Structured result must preserve tax=3.0, not force 39.0
    expected_bill = Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, unit_price=299.0, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, unit_price=399.0, total_price=399.0),
            BillItem(name="Coke", quantity=1, unit_price=80.0, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        discount=None,
        total=817.0,
        currency="INR",
        confidence="medium",
    )

    from services.bill_parser import validate_bill_consistency

    mock_chain = RunnableLambda(lambda x: expected_bill)
    service = BillParserService(api_key="test-key", chain=mock_chain)
    result = await service.parse_bill(ocr_text)

    # Tax must be exactly 3.0
    assert result.tax == 3.0
    assert result.subtotal == 778.0
    assert result.total == 817.0

    # Validation detects inconsistency
    validation = validate_bill_consistency(result)
    assert validation.is_consistent is False
    assert validation.difference == 36.0



