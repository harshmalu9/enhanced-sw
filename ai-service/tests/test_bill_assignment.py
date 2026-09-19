import pytest
from langchain_core.runnables import RunnableLambda
from models.assignment import BillAssignmentResult, ItemAssignment
from models.bill import Bill, BillItem
from services.bill_assignment import (
    BillAssignmentAmbiguityError,
    BillAssignmentAPIError,
    BillAssignmentConfigError,
    BillAssignmentService,
    BillAssignmentValidationError,
)


@pytest.fixture
def sample_bill():
    return Bill(
        merchant="Domino's Pizza",
        items=[
            BillItem(name="Margherita Pizza", quantity=1, total_price=299.0),
            BillItem(name="Farmhouse Pizza", quantity=1, total_price=399.0),
            BillItem(name="Coke", quantity=1, total_price=80.0),
        ],
        subtotal=778.0,
        tax=3.0,
        total=817.0,
        currency="INR",
    )


@pytest.mark.asyncio
async def test_assign_items_success(sample_bill):
    mock_llm_result = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Farmhouse Pizza", people=["B", "C"]),
            ItemAssignment(item_name="Coke", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    mock_chain = RunnableLambda(lambda x: mock_llm_result)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    result = await service.assign_items(
        bill=sample_bill,
        people=["A", "B", "C"],
        instruction="A and B had the Margherita, B and C had the farmhouse, and all three had coke.",
    )

    assert len(result.assignments) == 3
    assert len(result.unassigned_items) == 0
    assert result.assignments[0].item_name == "Margherita Pizza"
    assert result.assignments[0].people == ["A", "B"]
    assert result.assignments[1].item_name == "Farmhouse Pizza"
    assert result.assignments[1].people == ["B", "C"]
    assert result.assignments[2].item_name == "Coke"
    assert result.assignments[2].people == ["A", "B", "C"]


@pytest.mark.asyncio
async def test_assign_items_detects_unassigned_items(sample_bill):
    # Farmhouse pizza was not consumed
    mock_llm_result = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "B"]),
            ItemAssignment(item_name="Coke", people=["A", "B", "C"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    mock_chain = RunnableLambda(lambda x: mock_llm_result)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    result = await service.assign_items(
        bill=sample_bill,
        people=["A", "B", "C"],
        instruction="A and B had the Margherita, all three had coke.",
    )

    # Farmhouse Pizza was not assigned
    assert "Farmhouse Pizza" in result.unassigned_items
    assert len(result.assignments) == 2


@pytest.mark.asyncio
async def test_assign_items_ambiguity_raises_error(sample_bill):
    mock_llm_result = BillAssignmentResult(
        assignments=[],
        unassigned_items=[],
        is_ambiguous=True,
        ambiguity_reason="Multiple pizzas exist on the bill and it is unclear which pizza was consumed.",
    )

    mock_chain = RunnableLambda(lambda x: mock_llm_result)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillAssignmentAmbiguityError) as exc_info:
        await service.assign_items(
            bill=sample_bill,
            people=["A", "B", "C"],
            instruction="John had the pizza.",
        )
    assert exc_info.value.code == "AMBIGUOUS_INSTRUCTION"
    assert "Multiple pizzas" in str(exc_info.value)


@pytest.mark.asyncio
async def test_assign_items_rejects_unknown_person(sample_bill):
    # LLM hallucinates person "Dave" not in people list ["A", "B", "C"]
    mock_llm_result = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Margherita Pizza", people=["A", "Dave"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    mock_chain = RunnableLambda(lambda x: mock_llm_result)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillAssignmentValidationError) as exc_info:
        await service.assign_items(
            bill=sample_bill,
            people=["A", "B", "C"],
            instruction="A and Dave had pizza.",
        )
    assert "Dave" in str(exc_info.value)


@pytest.mark.asyncio
async def test_assign_items_rejects_unknown_item(sample_bill):
    # LLM hallucinates item "Sushi" not on bill
    mock_llm_result = BillAssignmentResult(
        assignments=[
            ItemAssignment(item_name="Sushi Platter", people=["A"]),
        ],
        unassigned_items=[],
        is_ambiguous=False,
    )

    mock_chain = RunnableLambda(lambda x: mock_llm_result)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillAssignmentValidationError) as exc_info:
        await service.assign_items(
            bill=sample_bill,
            people=["A", "B", "C"],
            instruction="A had sushi.",
        )
    assert "Sushi Platter" in str(exc_info.value)


@pytest.mark.asyncio
async def test_assign_items_missing_api_key(sample_bill, monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    service = BillAssignmentService(api_key=None, llm=None, chain=None)
    with pytest.raises(BillAssignmentConfigError) as exc_info:
        await service.assign_items(
            bill=sample_bill,
            people=["A", "B"],
            instruction="A had pizza.",
        )
    assert exc_info.value.code == "MISSING_API_KEY"


@pytest.mark.asyncio
async def test_assign_items_api_error(sample_bill):
    def raise_err(_):
        raise RuntimeError("Gemini service timeout")

    mock_chain = RunnableLambda(raise_err)
    service = BillAssignmentService(api_key="test-key", chain=mock_chain)
    with pytest.raises(BillAssignmentAPIError) as exc_info:
        await service.assign_items(
            bill=sample_bill,
            people=["A", "B"],
            instruction="A had pizza.",
        )
    assert exc_info.value.code == "GEMINI_API_ERROR"


def test_bill_assignment_gemini_initialization_and_structured_output(monkeypatch):
    from unittest.mock import MagicMock, patch

    monkeypatch.setenv("GOOGLE_API_KEY", "test-env-gemini-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.6-flash")

    with patch("services.bill_assignment.ChatGoogleGenerativeAI") as mock_gemini_cls:
        mock_llm_instance = MagicMock()
        mock_structured_llm = MagicMock()
        mock_llm_instance.with_structured_output.return_value = mock_structured_llm
        mock_gemini_cls.return_value = mock_llm_instance

        service = BillAssignmentService()
        chain = service._get_chain()

        mock_gemini_cls.assert_called_once_with(
            model="gemini-3.6-flash",
            google_api_key="test-env-gemini-key",
            temperature=0.0,
        )
        mock_llm_instance.with_structured_output.assert_called_once_with(BillAssignmentResult)


