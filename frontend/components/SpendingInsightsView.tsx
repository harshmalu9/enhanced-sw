import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getSpendingInsights,
  getSpendingForecast,
  detectAnomalies,
  ApiError,
} from "../services/api";
import { SpendingInsightsDataResult } from "../types/spending";
import { SpendingForecastResponse } from "../types/forecast";
import { AnomalyDetectionResponse, AnomalyItem } from "../types/anomaly";
import { ErrorBanner } from "./ErrorBanner";

interface SpendingInsightsViewProps {
  onNavigateToAdd?: () => void;
}

type InsightsTab = "analysis" | "forecast" | "anomalies";

export const SpendingInsightsView: React.FC<SpendingInsightsViewProps> = ({ onNavigateToAdd }) => {
  const [activeTab, setActiveTab] = useState<InsightsTab>("analysis");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [insightsResult, setInsightsResult] = useState<SpendingInsightsDataResult | null>(null);
  const [forecastResult, setForecastResult] = useState<SpendingForecastResponse | null>(null);
  const [anomalyResult, setAnomalyResult] = useState<AnomalyDetectionResponse | null>(null);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [insightsRes, forecastRes, anomaliesRes] = await Promise.all([
        getSpendingInsights(),
        getSpendingForecast(14).catch(() => null),
        detectAnomalies(2.0).catch(() => null),
      ]);

      setInsightsResult(insightsRes.data);
      if (forecastRes) setForecastResult(forecastRes);
      if (anomaliesRes) setAnomalyResult(anomaliesRes);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while analyzing spending.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const getSeverityBadgeStyle = (sev: "HIGH" | "MEDIUM" | "MILD") => {
    switch (sev) {
      case "HIGH":
        return { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" };
      case "MEDIUM":
        return { bg: "#fef3c7", text: "#d97706", border: "#fcd34d" };
      case "MILD":
        return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Spending Intelligence</Text>
          <Text style={styles.subtitle}>
            Analytics, Prophet time-series forecasting & statistical anomaly detection
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchAllData}
          disabled={isLoading}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Navigation Tabs */}
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTabButton, activeTab === "analysis" && styles.subTabButtonActive]}
          onPress={() => setActiveTab("analysis")}
          activeOpacity={0.7}
        >
          <Text style={[styles.subTabText, activeTab === "analysis" && styles.subTabTextActive]}>
            📊 Analysis
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabButton, activeTab === "forecast" && styles.subTabButtonActive]}
          onPress={() => setActiveTab("forecast")}
          activeOpacity={0.7}
        >
          <Text style={[styles.subTabText, activeTab === "forecast" && styles.subTabTextActive]}>
            📈 Prophet Forecast
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabButton, activeTab === "anomalies" && styles.subTabButtonActive]}
          onPress={() => setActiveTab("anomalies")}
          activeOpacity={0.7}
        >
          <Text style={[styles.subTabText, activeTab === "anomalies" && styles.subTabTextActive]}>
            ⚠️ Anomalies {anomalyResult && anomalyResult.anomalies_detected_count > 0 ? `(${anomalyResult.anomalies_detected_count})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={fetchAllData}
      />

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Running AI & Prophet models...</Text>
        </View>
      ) : !insightsResult || insightsResult.summary.expense_count === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💡</Text>
          <Text style={styles.emptyTitle}>No expense data to analyze</Text>
          <Text style={styles.emptySubtitle}>
            Add some expenses or click "Load Demo Data" to test the AI analytics, forecasting, and anomaly models.
          </Text>
          {onNavigateToAdd && (
            <TouchableOpacity
              style={styles.addExpenseBtn}
              onPress={onNavigateToAdd}
              activeOpacity={0.8}
            >
              <Text style={styles.addExpenseBtnText}>➕ Add an Expense</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          {/* TAB 1: Analysis & Insights */}
          {activeTab === "analysis" && (
            <>
              {/* Metric Cards */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Total Spent</Text>
                  <Text style={styles.metricValue}>
                    ₹{insightsResult.summary.total_spending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Expenses</Text>
                  <Text style={styles.metricValue}>{insightsResult.summary.expense_count}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Avg. Expense</Text>
                  <Text style={styles.metricValue}>
                    ₹{insightsResult.summary.average_expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* Highest Category Callout */}
              {insightsResult.summary.highest_spending_category && (
                <View style={styles.highestCard}>
                  <Text style={styles.highestLabel}>TOP SPENDING CATEGORY</Text>
                  <View style={styles.highestRow}>
                    <Text style={styles.highestCategory}>
                      {insightsResult.summary.highest_spending_category.category}
                    </Text>
                    <Text style={styles.highestAmount}>
                      ₹{insightsResult.summary.highest_spending_category.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                      ({insightsResult.summary.highest_spending_category.percentage}%)
                    </Text>
                  </View>
                </View>
              )}

              {/* Category Breakdown */}
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Category Breakdown</Text>
                {Object.entries(insightsResult.summary.spending_by_category).map(([cat, amt]) => {
                  const pct = insightsResult.summary.category_percentages[cat] || 0;
                  return (
                    <View key={cat} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <Text style={styles.categoryName}>{cat}</Text>
                        <Text style={styles.categoryPct}>{pct}%</Text>
                      </View>
                      <Text style={styles.categoryAmt}>
                        ₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* AI Insights Section */}
              {insightsResult.insights && insightsResult.insights.length > 0 && (
                <View style={styles.insightsCard}>
                  <View style={styles.insightsHeader}>
                    <Text style={styles.insightsTitle}>💡 AI Spending Observations</Text>
                  </View>
                  {insightsResult.insights.map((insight, idx) => (
                    <View key={idx} style={styles.insightItem}>
                      <Text style={styles.insightBullet}>•</Text>
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* TAB 2: Prophet Time-Series Forecast */}
          {activeTab === "forecast" && (
            <View>
              {!forecastResult || !forecastResult.has_sufficient_data ? (
                <View style={styles.forecastNoticeCard}>
                  <Text style={styles.noticeIcon}>📉</Text>
                  <Text style={styles.noticeTitle}>Insufficient Historical Data</Text>
                  <Text style={styles.noticeText}>
                    {forecastResult?.forecast_explanation ||
                      "Prophet time-series forecasting requires at least 5 expenses spanning multiple days."}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Model Banner */}
                  <View style={styles.modelPill}>
                    <Text style={styles.modelPillLabel}>Forecasting Model:</Text>
                    <Text style={styles.modelPillValue}>
                      {forecastResult.model_name || "Meta Prophet"} (Weekly Seasonality + Trend)
                    </Text>
                  </View>

                  {/* Forecast Summary Metrics */}
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Daily Burn Rate</Text>
                      <Text style={styles.metricValue}>
                        ₹{forecastResult.projected_daily_average.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Next 14 Days</Text>
                      <Text style={styles.metricValue}>
                        ₹{forecastResult.projected_horizon_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>30-Day Outlook</Text>
                      <Text style={styles.metricValue}>
                        ₹{forecastResult.projected_30_day_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* Explanation Callout */}
                  <View style={styles.forecastExpCard}>
                    <Text style={styles.forecastExpTitle}>📈 Model Projection Summary</Text>
                    <Text style={styles.forecastExpText}>
                      {forecastResult.forecast_explanation}
                    </Text>
                  </View>

                  {/* Daily Projection Schedule */}
                  <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>Daily Predicted Schedule (Next 7 Days)</Text>
                    {forecastResult.forecast_points.slice(0, 7).map((pt, i) => (
                      <View key={i} style={styles.breakdownRow}>
                        <View style={styles.breakdownLeft}>
                          <Text style={styles.categoryName}>{pt.date}</Text>
                          <Text style={styles.rangeText}>
                            [₹{pt.lower_bound.toFixed(0)} – ₹{pt.upper_bound.toFixed(0)}]
                          </Text>
                        </View>
                        <Text style={styles.forecastAmt}>
                          ₹{pt.predicted_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Category Projections */}
                  {forecastResult.category_forecasts.length > 0 && (
                    <View style={styles.breakdownCard}>
                      <Text style={styles.breakdownTitle}>Category 30-Day Projections</Text>
                      {forecastResult.category_forecasts.slice(0, 5).map((cf, i) => (
                        <View key={i} style={styles.breakdownRow}>
                          <Text style={styles.categoryName}>{cf.category}</Text>
                          <Text style={styles.categoryAmt}>
                            ₹{cf.projected_next_month.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* TAB 3: Anomaly Detection */}
          {activeTab === "anomalies" && (
            <View>
              {!anomalyResult || !anomalyResult.has_sufficient_history ? (
                <View style={styles.forecastNoticeCard}>
                  <Text style={styles.noticeIcon}>ℹ️</Text>
                  <Text style={styles.noticeTitle}>Insufficient Historical Baseline</Text>
                  <Text style={styles.noticeText}>
                    {anomalyResult?.summary_message ||
                      "Statistical anomaly detection requires at least 3 historical expenses to establish baselines."}
                  </Text>
                </View>
              ) : anomalyResult.anomalies_detected_count === 0 ? (
                <View style={styles.cleanAnomaliesCard}>
                  <Text style={styles.cleanIcon}>✓</Text>
                  <Text style={styles.cleanTitle}>No Spending Anomalies Detected</Text>
                  <Text style={styles.cleanText}>
                    All {anomalyResult.total_expenses_analyzed} analyzed transactions fall within typical statistical bounds (mean ± 2.0σ).
                  </Text>
                </View>
              ) : (
                <View>
                  <View style={styles.anomalySummaryBanner}>
                    <Text style={styles.anomalySummaryText}>
                      🚨 Found {anomalyResult.anomalies_detected_count} unusual spending transactions significantly deviating from your category baselines.
                    </Text>
                  </View>

                  {anomalyResult.anomalies.map((a: AnomalyItem, i: number) => {
                    const badge = getSeverityBadgeStyle(a.severity);
                    return (
                      <View key={i} style={styles.anomalyCard}>
                        <View style={styles.anomalyHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.anomalyDesc}>{a.description}</Text>
                            <Text style={styles.anomalyCategory}>
                              {a.category} • {a.expense_date || "Recent"}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.severityBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.severityText, { color: badge.text }]}>
                              {a.severity} ANOMALY
                            </Text>
                          </View>
                        </View>

                        <View style={styles.anomalyAmountRow}>
                          <Text style={styles.anomalyAmount}>
                            ₹{a.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </Text>
                          <Text style={styles.anomalyRatio}>
                            {a.deviation_factor.toFixed(1)}x category average
                          </Text>
                        </View>

                        <Text style={styles.anomalyReason}>
                          💬 {a.reason}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    maxWidth: 270,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  refreshButtonText: {
    fontSize: 16,
    color: "#475569",
    fontWeight: "700",
  },
  subTabContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
    marginVertical: 10,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 8,
  },
  subTabButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  subTabTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  addExpenseBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  addExpenseBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  resultsContainer: {
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 2,
    textAlign: "center",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  highestCard: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  highestLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1d4ed8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  highestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  highestCategory: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  highestAmount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  breakdownCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  categoryPct: {
    fontSize: 10,
    color: "#64748b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryAmt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  rangeText: {
    fontSize: 10,
    color: "#94a3b8",
  },
  forecastAmt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  insightsCard: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 12,
  },
  insightsHeader: {
    marginBottom: 6,
  },
  insightsTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e40af",
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  insightBullet: {
    fontSize: 12,
    color: "#2563eb",
    marginRight: 6,
    lineHeight: 16,
  },
  insightText: {
    fontSize: 12,
    color: "#1e3a8a",
    lineHeight: 16,
    flex: 1,
  },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  modelPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    marginRight: 4,
  },
  modelPillValue: {
    fontSize: 11,
    color: "#15803d",
    fontWeight: "600",
  },
  forecastExpCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  forecastExpTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  forecastExpText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  forecastNoticeCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginVertical: 12,
  },
  noticeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },
  cleanAnomaliesCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginVertical: 8,
  },
  cleanIcon: {
    fontSize: 24,
    color: "#16a34a",
    fontWeight: "800",
    marginBottom: 4,
  },
  cleanTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 4,
  },
  cleanText: {
    fontSize: 12,
    color: "#15803d",
    textAlign: "center",
    lineHeight: 16,
  },
  anomalySummaryBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  anomalySummaryText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
  },
  anomalyCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  anomalyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  anomalyDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  anomalyCategory: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  anomalyAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  anomalyAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#dc2626",
  },
  anomalyRatio: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ea580c",
  },
  anomalyReason: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 15,
    marginTop: 4,
    backgroundColor: "#fff7ed",
    padding: 6,
    borderRadius: 6,
  },
});
