from typing import List, Optional
from pydantic import BaseModel, Field


class ExpenseItemForAnomaly(BaseModel):
    id: Optional[str] = None
    description: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    category: str = Field(..., min_length=1)
    merchant: Optional[str] = None
    expense_date: Optional[str] = None


class CategoryAnomalyStats(BaseModel):
    category: str
    transaction_count: int
    mean_amount: float
    std_dev: float
    threshold_amount: float


class AnomalyItem(BaseModel):
    expense_id: Optional[str] = None
    description: str
    amount: float
    category: str
    expense_date: Optional[str] = None
    severity: str  # "HIGH", "MEDIUM", "MILD"
    reason: str
    baseline_mean: float
    threshold: float
    deviation_factor: float  # e.g. 2.8x mean


class AnomalyDetectionRequest(BaseModel):
    expenses: List[ExpenseItemForAnomaly] = Field(default_factory=list)
    sensitivity_factor: Optional[float] = Field(default=2.0, ge=1.0, le=4.0)


class AnomalyDetectionResponse(BaseModel):
    success: bool
    total_expenses_analyzed: int
    anomalies_detected_count: int
    anomalies: List[AnomalyItem]
    category_baselines: List[CategoryAnomalyStats]
    summary_message: str
    has_sufficient_history: bool
