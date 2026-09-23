from typing import List, Optional
from pydantic import BaseModel, Field


class ExpenseItemForForecast(BaseModel):
    id: Optional[str] = None
    description: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    category: str = Field(..., min_length=1)
    expense_date: str = Field(..., min_length=10)  # 'YYYY-MM-DD'


class DailyForecastPoint(BaseModel):
    date: str  # 'YYYY-MM-DD'
    predicted_amount: float
    lower_bound: float
    upper_bound: float
    is_historical: bool = False


class CategoryForecast(BaseModel):
    category: str
    historical_daily_avg: float
    projected_next_month: float
    trend_direction: str  # "INCREASING", "DECREASING", "STABLE"


class SpendingForecastRequest(BaseModel):
    expenses: List[ExpenseItemForForecast] = Field(default_factory=list)
    horizon_days: Optional[int] = Field(default=14, ge=3, le=90)


class SpendingForecastResponse(BaseModel):
    success: bool
    has_sufficient_data: bool
    model_name: Optional[str] = "Prophet"
    data_points_count: int
    historical_daily_average: float
    projected_daily_average: float
    projected_horizon_total: float
    projected_30_day_total: float
    trend_slope: float
    trend_direction: str  # "UPWARD", "DOWNWARD", "STABLE"
    forecast_points: List[DailyForecastPoint]
    category_forecasts: List[CategoryForecast]
    forecast_explanation: str
