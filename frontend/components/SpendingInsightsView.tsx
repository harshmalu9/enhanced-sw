import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Elevation, Shapes, Typography } from "../constants/theme";
import { getSpendingInsights, getSpendingForecast, detectAnomalies } from "../services/api";
import { SpendingInsightsDataResult } from "../types/spending";
import { SpendingForecastResponse } from "../types/forecast";
import { AnomalyDetectionResponse, AnomalyItem } from "../types/anomaly";
import { CategoryIcon } from "./CategoryIcon";
import { EmptyState } from "./EmptyState";

interface SpendingInsightsViewProps {
  onOpenAddExpense: () => void;
  refreshTrigger?: number;
}

type PeriodFilter = "this_month" | "last_30_days";

export const SpendingInsightsView: React.FC<SpendingInsightsViewProps> = ({
  onOpenAddExpense,
  refreshTrigger = 0,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [insights, setInsights] = useState<SpendingInsightsDataResult | null>(null);
  const [forecast, setForecast] = useState<SpendingForecastResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [insightsRes, forecastRes, anomalyRes] = await Promise.all([
        getSpendingInsights().catch(() => null),
        getSpendingForecast(14).catch(() => null),
        detectAnomalies(2.0).catch(() => null),
      ]);

      if (insightsRes) setInsights(insightsRes.data);
      if (forecastRes) setForecast(forecastRes);
      if (anomalyRes) setAnomalies(anomalyRes);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handlePullRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const formatCurrency = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyWhole = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const hasData = insights && insights.summary && insights.summary.expense_count > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullRefresh}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Top Period Selector */}
      <View style={styles.periodSelectorRow}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            period === "this_month" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod("this_month")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.periodButtonText,
              period === "this_month" && styles.periodButtonTextActive,
            ]}
          >
            This Month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            period === "last_30_days" && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod("last_30_days")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.periodButtonText,
              period === "last_30_days" && styles.periodButtonTextActive,
            ]}
          >
            Last 30 Days
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !hasData ? (
        <EmptyState
          icon="insights"
          title="Not enough transaction data"
          message="Record a few more expenses to see category breakdowns, forecasts, and spending observations."
          actionLabel="Add Expense"
          onAction={onOpenAddExpense}
        />
      ) : (
        <>
          {/* 1. Spending Summary Grid */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryMetricCard}>
              <Text style={styles.metricLabel}>Total Spending</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(insights.summary.total_spending)}
              </Text>
              <Text style={styles.metricSub}>
                {insights.summary.expense_count} transaction{insights.summary.expense_count === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.summaryMetricCard}>
              <Text style={styles.metricLabel}>Daily Average</Text>
              <Text style={styles.metricValue}>
                {forecast?.projected_daily_average
                  ? formatCurrency(forecast.projected_daily_average)
                  : formatCurrency(insights.summary.average_expense)}
              </Text>
              <Text style={styles.metricSub}>Current burn rate</Text>
            </View>
          </View>

          {/* 2. Top Category Highlight Banner */}
          {insights.summary.highest_spending_category && (
            <View style={styles.topCategoryCard}>
              <View style={styles.topCategoryHeader}>
                <Text style={styles.topCategoryTag}>Top Category</Text>
                <Text style={styles.topCategoryPct}>
                  {insights.summary.highest_spending_category.percentage}% of total
                </Text>
              </View>
              <View style={styles.topCategoryBody}>
                <CategoryIcon
                  category={insights.summary.highest_spending_category.category}
                  size={42}
                  iconSize={22}
                />
                <View style={styles.topCategoryInfo}>
                  <Text style={styles.topCategoryName}>
                    {insights.summary.highest_spending_category.category}
                  </Text>
                  <Text style={styles.topCategoryAmount}>
                    {formatCurrency(insights.summary.highest_spending_category.amount)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 3. Category Spending Breakdown */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Category Breakdown</Text>
            <Text style={styles.cardSubtitle}>
              Distribution of your recorded expenses
            </Text>

            <View style={styles.categoryBreakdownList}>
              {Object.entries(insights.summary.spending_by_category).map(([cat, amt]) => {
                const pct = insights.summary.category_percentages[cat] || 0;
                return (
                  <View key={cat} style={styles.categoryBreakdownRow}>
                    <View style={styles.categoryRowHeader}>
                      <View style={styles.categoryLeft}>
                        <CategoryIcon category={cat} size={28} iconSize={16} />
                        <Text style={styles.categoryRowName}>{cat}</Text>
                      </View>
                      <View style={styles.categoryRight}>
                        <Text style={styles.categoryRowAmount}>{formatCurrency(amt)}</Text>
                        <Text style={styles.categoryRowPct}>{pct}%</Text>
                      </View>
                    </View>
                    <View style={styles.categoryProgressTrack}>
                      <View
                        style={[
                          styles.categoryProgressFill,
                          { width: `${Math.min(pct, 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 4. Projected Month-End Outlook */}
          {forecast && forecast.has_sufficient_data && (
            <View style={styles.card}>
              <View style={styles.forecastHeader}>
                <MaterialIcons name="trending-up" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Projected Spending Outlook</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Estimated based on your historical spending velocity
              </Text>

              <View style={styles.forecastBox}>
                <View style={styles.forecastMetricRow}>
                  <Text style={styles.forecastMetricLabel}>Estimated 30-Day Total</Text>
                  <Text style={styles.forecastMetricValue}>
                    {formatCurrencyWhole(forecast.projected_30_day_total)}
                  </Text>
                </View>

                <View style={styles.forecastMetricRow}>
                  <Text style={styles.forecastMetricLabel}>Next 14 Days Projection</Text>
                  <Text style={styles.forecastMetricValue}>
                    {formatCurrencyWhole(forecast.projected_horizon_total)}
                  </Text>
                </View>
              </View>

              <Text style={styles.forecastExplanation}>
                {forecast.forecast_explanation ||
                  `At your current spending pace of ${formatCurrencyWhole(
                    forecast.projected_daily_average
                  )}/day, your month-end total will be around ${formatCurrencyWhole(
                    forecast.projected_30_day_total
                  )}.`}
              </Text>
            </View>
          )}

          {/* 5. Irregular Spending (Anomalies) */}
          {anomalies && anomalies.has_sufficient_history && (
            <View style={styles.card}>
              <View style={styles.anomaliesHeader}>
                <MaterialIcons
                  name={
                    anomalies.anomalies_detected_count > 0
                      ? "notifications-active"
                      : "verified"
                  }
                  size={20}
                  color={
                    anomalies.anomalies_detected_count > 0
                      ? Colors.warning
                      : Colors.success
                  }
                />
                <Text style={styles.cardTitle}>Flagged Transactions</Text>
              </View>

              {anomalies.anomalies_detected_count === 0 ? (
                <View style={styles.cleanAnomaliesBox}>
                  <Text style={styles.cleanAnomaliesTitle}>No unusual transactions</Text>
                  <Text style={styles.cleanAnomaliesText}>
                    All {anomalies.total_expenses_analyzed} analyzed transactions align with your
                    typical spending ranges.
                  </Text>
                </View>
              ) : (
                <View style={styles.anomaliesList}>
                  {anomalies.anomalies.map((a: AnomalyItem, i: number) => {
                    const isHigh = a.severity === "HIGH";
                    return (
                      <View
                        key={i}
                        style={[
                          styles.anomalyCardItem,
                          isHigh && styles.anomalyCardHigh,
                        ]}
                      >
                        <View style={styles.anomalyTopRow}>
                          <View style={styles.anomalyDescCol}>
                            <Text style={styles.anomalyDesc}>{a.description}</Text>
                            <Text style={styles.anomalyMeta}>
                              {a.category} {a.expense_date ? `• ${a.expense_date}` : ""}
                            </Text>
                          </View>
                          <Text style={styles.anomalyAmount}>{formatCurrency(a.amount)}</Text>
                        </View>
                        <Text style={styles.anomalyReasonText}>
                          {isHigh
                            ? "This expense is significantly higher than your usual spending in this category."
                            : "This transaction is higher than your category average."}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* 6. Contextual Observations */}
          {insights.insights && insights.insights.length > 0 && (
            <View style={styles.observationsCard}>
              <Text style={styles.observationsTitle}>Spending Summary</Text>
              {insights.insights.map((item, idx) => (
                <View key={idx} style={styles.observationRow}>
                  <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
                  <Text style={styles.observationText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  periodSelectorRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusSm,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: Shapes.radiusSm,
  },
  periodButtonActive: {
    backgroundColor: Colors.primaryContainer,
  },
  periodButtonText: {
    ...Typography.labelMedium,
    color: Colors.secondaryText,
    fontSize: 12,
  },
  periodButtonTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryMetricCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 14,
    ...Elevation.level1,
  },
  metricLabel: {
    ...Typography.labelSmall,
    color: Colors.secondaryText,
    marginBottom: 4,
  },
  metricValue: {
    ...Typography.amountMedium,
    fontSize: 18,
    color: Colors.primaryText,
    marginBottom: 2,
  },
  metricSub: {
    ...Typography.bodySmall,
    color: Colors.tertiaryText,
    fontSize: 11,
  },
  topCategoryCard: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: Shapes.radiusMd,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  topCategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  topCategoryTag: {
    ...Typography.labelSmall,
    color: Colors.onSecondaryContainer,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  topCategoryPct: {
    ...Typography.labelSmall,
    color: Colors.onSecondaryContainer,
    fontWeight: "600",
  },
  topCategoryBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topCategoryInfo: {
    flex: 1,
  },
  topCategoryName: {
    ...Typography.titleMedium,
    color: Colors.primaryText,
    fontWeight: "700",
  },
  topCategoryAmount: {
    ...Typography.amountMedium,
    color: Colors.primary,
    fontSize: 16,
    marginTop: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 16,
    marginBottom: 12,
    ...Elevation.level1,
  },
  cardTitle: {
    ...Typography.titleMedium,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primaryText,
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
    marginBottom: 12,
  },
  categoryBreakdownList: {
    gap: 12,
  },
  categoryBreakdownRow: {
    gap: 6,
  },
  categoryRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryRowName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Colors.primaryText,
  },
  categoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryRowAmount: {
    ...Typography.amountMedium,
    fontSize: 14,
    color: Colors.primaryText,
  },
  categoryRowPct: {
    ...Typography.labelSmall,
    color: Colors.secondaryText,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Shapes.radiusSm,
    minWidth: 32,
    textAlign: "center",
  },
  categoryProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceVariant,
    overflow: "hidden",
  },
  categoryProgressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  forecastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  forecastBox: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  forecastMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forecastMetricLabel: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
  },
  forecastMetricValue: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    fontWeight: "700",
  },
  forecastExplanation: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    lineHeight: 18,
  },
  anomaliesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  cleanAnomaliesBox: {
    backgroundColor: Colors.successContainer,
    borderRadius: Shapes.radiusSm,
    padding: 12,
  },
  cleanAnomaliesTitle: {
    ...Typography.titleSmall,
    color: Colors.success,
    fontWeight: "700",
    marginBottom: 2,
  },
  cleanAnomaliesText: {
    ...Typography.bodySmall,
    color: "#065F46",
  },
  anomaliesList: {
    gap: 8,
  },
  anomalyCardItem: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  anomalyCardHigh: {
    borderLeftColor: Colors.error,
  },
  anomalyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  anomalyDescCol: {
    flex: 1,
    marginRight: 8,
  },
  anomalyDesc: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
  },
  anomalyMeta: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 1,
  },
  anomalyAmount: {
    ...Typography.amountMedium,
    fontSize: 15,
    color: Colors.primaryText,
  },
  anomalyReasonText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 16,
  },
  observationsCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusMd,
    padding: 14,
  },
  observationsTitle: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    marginBottom: 8,
  },
  observationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginVertical: 2,
  },
  observationText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    flex: 1,
    lineHeight: 18,
  },
});
