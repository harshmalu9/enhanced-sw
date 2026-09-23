import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List
import pandas as pd
from prophet import Prophet

from .schemas import (
    CategoryForecast,
    DailyForecastPoint,
    ExpenseItemForForecast,
    SpendingForecastRequest,
    SpendingForecastResponse,
)

logger = logging.getLogger("enhanced-sw-ai.forecast")


class SpendingForecasterService:
    """
    Time-series spending forecasting engine powered by Meta Prophet.
    Models historical daily expense series with trend and weekly seasonality components.
    """

    def __init__(self):
        self.model_name = "Prophet"

    def forecast_spending(self, request: SpendingForecastRequest) -> SpendingForecastResponse:
        expenses = request.expenses
        horizon = request.horizon_days or 14

        if not expenses:
            return SpendingForecastResponse(
                success=True,
                has_sufficient_data=False,
                model_name=self.model_name,
                data_points_count=0,
                historical_daily_average=0.0,
                projected_daily_average=0.0,
                projected_horizon_total=0.0,
                projected_30_day_total=0.0,
                trend_slope=0.0,
                trend_direction="STABLE",
                forecast_points=[],
                category_forecasts=[],
                forecast_explanation="No historical expense data available to generate spending forecasts.",
            )

        # Parse and filter valid dates
        valid_records = []
        category_totals: Dict[str, float] = {}

        for exp in expenses:
            try:
                dt_str = exp.expense_date[:10]
                dt = datetime.strptime(dt_str, "%Y-%m-%d").date()
                valid_records.append({"ds": dt, "amount": float(exp.amount), "category": exp.category})
                category_totals[exp.category] = category_totals.get(exp.category, 0.0) + float(exp.amount)
            except Exception:
                continue

        if len(valid_records) < 5:
            return SpendingForecastResponse(
                success=True,
                has_sufficient_data=False,
                model_name=self.model_name,
                data_points_count=len(valid_records),
                historical_daily_average=0.0,
                projected_daily_average=0.0,
                projected_horizon_total=0.0,
                projected_30_day_total=0.0,
                trend_slope=0.0,
                trend_direction="STABLE",
                forecast_points=[],
                category_forecasts=[],
                forecast_explanation=(
                    f"Insufficient historical data ({len(valid_records)} transactions found). "
                    f"Prophet time-series forecasting requires at least 5 transactions across multiple dates."
                ),
            )

        # Build contiguous daily time-series dataframe for Prophet
        valid_records.sort(key=lambda r: r["ds"])
        min_date = valid_records[0]["ds"]
        max_date = valid_records[-1]["ds"]
        days_span = (max_date - min_date).days + 1

        if days_span < 3:
            return SpendingForecastResponse(
                success=True,
                has_sufficient_data=False,
                model_name=self.model_name,
                data_points_count=len(valid_records),
                historical_daily_average=0.0,
                projected_daily_average=0.0,
                projected_horizon_total=0.0,
                projected_30_day_total=0.0,
                trend_slope=0.0,
                trend_direction="STABLE",
                forecast_points=[],
                category_forecasts=[],
                forecast_explanation=(
                    f"Time span too short ({days_span} days). "
                    f"Prophet time-series forecasting requires transactions spanning at least 3 distinct days."
                ),
            )

        # Aggregate daily sums
        daily_map: Dict[datetime.date, float] = {}
        curr = min_date
        while curr <= max_date:
            daily_map[curr] = 0.0
            curr += timedelta(days=1)

        for rec in valid_records:
            daily_map[rec["ds"]] = daily_map.get(rec["ds"], 0.0) + rec["amount"]

        # Prepare Prophet DataFrame with standard 'ds' and 'y' columns
        df_prophet = pd.DataFrame(
            [{"ds": pd.to_datetime(d), "y": amt} for d, amt in sorted(daily_map.items())]
        )

        historical_total = df_prophet["y"].sum()
        historical_daily_avg = float(historical_total / max(len(df_prophet), 1))

        # Fit Prophet model
        # Disable noisy output
        try:
            # Silence cmdstanpy logger for clean API operation
            logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
            logging.getLogger("prophet").setLevel(logging.WARNING)

            # Enable weekly seasonality if we have enough days
            has_weekly = len(df_prophet) >= 7

            model = Prophet(
                growth="linear",
                daily_seasonality=False,
                weekly_seasonality=has_weekly,
                yearly_seasonality=False,
                interval_width=0.80,
            )

            model.fit(df_prophet)

            # Create future dataframe for horizon days
            future_df = model.make_future_dataframe(periods=horizon, freq="D", include_history=False)
            forecast_df = model.predict(future_df)

        except Exception as exc:
            logger.error("Prophet model fitting failed: %s", str(exc), exc_info=True)
            # Graceful fallback: return simple baseline projection
            return self._build_fallback_response(
                valid_records=valid_records,
                days_span=days_span,
                category_totals=category_totals,
                historical_daily_avg=historical_daily_avg,
                max_date=max_date,
                horizon=horizon,
                error_msg=str(exc),
            )

        # Extract forecasted future data points
        forecast_points: List[DailyForecastPoint] = []
        projected_sum = 0.0

        for _, row in forecast_df.iterrows():
            date_str = pd.to_datetime(row["ds"]).strftime("%Y-%m-%d")
            pred = max(0.0, float(round(row["yhat"], 2)))
            lower = max(0.0, float(round(row["yhat_lower"], 2)))
            upper = max(0.0, float(round(row["yhat_upper"], 2)))

            # Ensure lower <= pred <= upper consistency
            if lower > pred:
                lower = round(pred * 0.7, 2)
            if upper < pred:
                upper = round(pred * 1.3, 2)

            projected_sum += pred
            forecast_points.append(
                DailyForecastPoint(
                    date=date_str,
                    predicted_amount=pred,
                    lower_bound=lower,
                    upper_bound=upper,
                    is_historical=False,
                )
            )

        projected_daily_avg = float(projected_sum / max(horizon, 1))
        projected_30_day = float(projected_daily_avg * 30.0)

        # Determine trend direction from Prophet's forecast slope
        if len(forecast_df) >= 2:
            first_trend = float(forecast_df["trend"].iloc[0])
            last_trend = float(forecast_df["trend"].iloc[-1])
            trend_slope = (last_trend - first_trend) / max(len(forecast_df) - 1, 1)
        else:
            trend_slope = 0.0

        if trend_slope > 5.0:
            trend_dir = "UPWARD"
        elif trend_slope < -5.0:
            trend_dir = "DOWNWARD"
        else:
            trend_dir = "STABLE"

        # Category forecasts based on historical category mix
        total_hist_spend = sum(category_totals.values())
        category_forecasts: List[CategoryForecast] = []

        for cat, cat_amt in category_totals.items():
            cat_share = cat_amt / total_hist_spend if total_hist_spend > 0 else 0.0
            cat_daily_avg = cat_amt / max(days_span, 1)
            cat_projected_30 = projected_30_day * cat_share

            category_forecasts.append(
                CategoryForecast(
                    category=cat,
                    historical_daily_avg=round(cat_daily_avg, 2),
                    projected_next_month=round(cat_projected_30, 2),
                    trend_direction=trend_dir,
                )
            )

        category_forecasts.sort(key=lambda c: c.projected_next_month, reverse=True)

        explanation = (
            f"Prophet time-series model analyzed {len(valid_records)} historical transactions across {days_span} days. "
            f"Baseline historical spending is ₹{historical_daily_avg:,.2f}/day. "
            f"Projected expenditure for the next {horizon} days is ₹{projected_sum:,.2f} "
            f"(~₹{projected_30_day:,.2f}/month) with a {trend_dir.lower()} trajectory "
            f"({'+' if trend_slope >= 0 else ''}{trend_slope:,.2f} ₹/day trend component)."
        )

        return SpendingForecastResponse(
            success=True,
            has_sufficient_data=True,
            model_name=self.model_name,
            data_points_count=len(valid_records),
            historical_daily_average=round(historical_daily_avg, 2),
            projected_daily_average=round(projected_daily_avg, 2),
            projected_horizon_total=round(projected_sum, 2),
            projected_30_day_total=round(projected_30_day, 2),
            trend_slope=round(trend_slope, 2),
            trend_direction=trend_dir,
            forecast_points=forecast_points,
            category_forecasts=category_forecasts,
            forecast_explanation=explanation,
        )

    def _build_fallback_response(
        self,
        valid_records: list,
        days_span: int,
        category_totals: dict,
        historical_daily_avg: float,
        max_date: datetime.date,
        horizon: int,
        error_msg: str,
    ) -> SpendingForecastResponse:
        """Graceful fallback when Prophet fitting cannot complete."""
        forecast_points: List[DailyForecastPoint] = []
        projected_sum = 0.0

        for h in range(1, horizon + 1):
            future_date = max_date + timedelta(days=h)
            pred = round(historical_daily_avg, 2)
            projected_sum += pred
            forecast_points.append(
                DailyForecastPoint(
                    date=future_date.strftime("%Y-%m-%d"),
                    predicted_amount=pred,
                    lower_bound=round(pred * 0.7, 2),
                    upper_bound=round(pred * 1.3, 2),
                    is_historical=False,
                )
            )

        projected_30_day = round(historical_daily_avg * 30.0, 2)

        return SpendingForecastResponse(
            success=True,
            has_sufficient_data=True,
            model_name="Baseline (Prophet Fallback)",
            data_points_count=len(valid_records),
            historical_daily_average=round(historical_daily_avg, 2),
            projected_daily_average=round(historical_daily_avg, 2),
            projected_horizon_total=round(projected_sum, 2),
            projected_30_day_total=projected_30_day,
            trend_slope=0.0,
            trend_direction="STABLE",
            forecast_points=forecast_points,
            category_forecasts=[],
            forecast_explanation=(
                f"Historical baseline forecast generated ({len(valid_records)} transactions, ₹{historical_daily_avg:,.2f}/day). "
                f"Prophet optimization notice: {error_msg}"
            ),
        )


_forecaster_instance = None


def get_spending_forecaster_service() -> SpendingForecasterService:
    global _forecaster_instance
    if _forecaster_instance is None:
        _forecaster_instance = SpendingForecasterService()
    return _forecaster_instance
