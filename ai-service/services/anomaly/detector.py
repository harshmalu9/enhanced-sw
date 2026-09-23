import math
from typing import Dict, List
from .schemas import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyItem,
    CategoryAnomalyStats,
    ExpenseItemForAnomaly,
)


class AnomalyDetectorService:
    """
    Deterministic, explainable statistical anomaly detection for personal expenses.
    Evaluates individual transactions against category-level historical spending baselines.
    """

    def __init__(self, default_k: float = 2.0, min_amount_threshold: float = 250.0):
        self.default_k = default_k
        self.min_amount_threshold = min_amount_threshold

    def detect_anomalies(self, request: AnomalyDetectionRequest) -> AnomalyDetectionResponse:
        expenses = request.expenses
        k = request.sensitivity_factor or self.default_k

        if not expenses:
            return AnomalyDetectionResponse(
                success=True,
                total_expenses_analyzed=0,
                anomalies_detected_count=0,
                anomalies=[],
                category_baselines=[],
                summary_message="No expenses provided for anomaly analysis.",
                has_sufficient_history=False,
            )

        if len(expenses) < 3:
            return AnomalyDetectionResponse(
                success=True,
                total_expenses_analyzed=len(expenses),
                anomalies_detected_count=0,
                anomalies=[],
                category_baselines=[],
                summary_message="Insufficient historical data (at least 3 expenses required for statistical anomaly detection).",
                has_sufficient_history=False,
            )

        # Group expenses by category
        by_category: Dict[str, List[ExpenseItemForAnomaly]] = {}
        for exp in expenses:
            cat = exp.category or "Other"
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(exp)

        category_baselines: List[CategoryAnomalyStats] = []
        anomalies: List[AnomalyItem] = []

        for category, cat_expenses in by_category.items():
            amounts = [e.amount for e in cat_expenses]
            n = len(amounts)

            if n < 3:
                # If category has fewer than 3 items, compute simple mean
                mean_val = sum(amounts) / n
                category_baselines.append(
                    CategoryAnomalyStats(
                        category=category,
                        transaction_count=n,
                        mean_amount=round(mean_val, 2),
                        std_dev=0.0,
                        threshold_amount=round(mean_val * 2.5, 2),
                    )
                )
                continue

            # Calculate category overall mean and std_dev for reporting
            mean_val = sum(amounts) / n
            variance = sum((x - mean_val) ** 2 for x in amounts) / (n - 1)
            std_dev = math.sqrt(variance)

            # Effective baseline threshold
            threshold = mean_val + k * max(std_dev, mean_val * 0.25)
            threshold = max(threshold, self.min_amount_threshold)

            category_baselines.append(
                CategoryAnomalyStats(
                    category=category,
                    transaction_count=n,
                    mean_amount=round(mean_val, 2),
                    std_dev=round(std_dev, 2),
                    threshold_amount=round(threshold, 2),
                )
            )

            # Evaluate each expense using leave-one-out baseline to prevent sample-skewing
            for i, exp in enumerate(cat_expenses):
                other_amounts = [x for j, x in enumerate(amounts) if j != i]
                if other_amounts:
                    loo_mean = sum(other_amounts) / len(other_amounts)
                    loo_var = (
                        sum((x - loo_mean) ** 2 for x in other_amounts) / (len(other_amounts) - 1)
                        if len(other_amounts) > 1
                        else (loo_mean * 0.3) ** 2
                    )
                    loo_std = math.sqrt(loo_var)
                else:
                    loo_mean = exp.amount
                    loo_std = 0.0

                item_threshold = max(
                    loo_mean + k * max(loo_std, loo_mean * 0.3),
                    self.min_amount_threshold,
                )

                if exp.amount > item_threshold and exp.amount >= self.min_amount_threshold:
                    ratio = round(exp.amount / loo_mean, 1) if loo_mean > 0 else 1.0

                    if exp.amount >= (loo_mean + 3.0 * max(loo_std, 1.0)) or ratio >= 3.0:
                        severity = "HIGH"
                    elif exp.amount >= (loo_mean + 2.0 * max(loo_std, 1.0)) or ratio >= 2.0:
                        severity = "MEDIUM"
                    else:
                        severity = "MILD"

                    reason = (
                        f"₹{exp.amount:,.2f} is {ratio}x higher than your typical {category} "
                        f"average of ₹{loo_mean:,.2f} (anomaly threshold: ₹{item_threshold:,.2f})."
                    )

                    anomalies.append(
                        AnomalyItem(
                            expense_id=exp.id,
                            description=exp.description,
                            amount=exp.amount,
                            category=category,
                            expense_date=exp.expense_date,
                            severity=severity,
                            reason=reason,
                            baseline_mean=round(loo_mean, 2),
                            threshold=round(item_threshold, 2),
                            deviation_factor=ratio,
                        )
                    )

        # Sort anomalies by severity and deviation factor descending
        severity_order = {"HIGH": 0, "MEDIUM": 1, "MILD": 2}
        anomalies.sort(key=lambda a: (severity_order.get(a.severity, 3), -a.deviation_factor))

        count = len(anomalies)
        summary = (
            f"Detected {count} unusual spending {'transaction' if count == 1 else 'transactions'} "
            f"exceeding normal statistical thresholds."
            if count > 0
            else "All transactions are within normal historical spending patterns."
        )

        return AnomalyDetectionResponse(
            success=True,
            total_expenses_analyzed=len(expenses),
            anomalies_detected_count=count,
            anomalies=anomalies,
            category_baselines=category_baselines,
            summary_message=summary,
            has_sufficient_history=True,
        )


_anomaly_detector_instance = None


def get_anomaly_detector_service() -> AnomalyDetectorService:
    global _anomaly_detector_instance
    if _anomaly_detector_instance is None:
        _anomaly_detector_instance = AnomalyDetectorService()
    return _anomaly_detector_instance
