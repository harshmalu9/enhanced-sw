import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getSpendingInsights, ApiError } from "../services/api";
import { SpendingInsightsDataResult } from "../types/spending";
import { ErrorBanner } from "./ErrorBanner";

interface SpendingInsightsViewProps {
  onNavigateToAdd?: () => void;
}

export const SpendingInsightsView: React.FC<SpendingInsightsViewProps> = ({ onNavigateToAdd }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpendingInsightsDataResult | null>(null);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getSpendingInsights();
      setResult(response.data);
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
    fetchInsights();
  }, [fetchInsights]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Spending Insights</Text>
          <Text style={styles.subtitle}>
            Financial breakdown and AI analysis grounded in your stored expenses.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchInsights}
          disabled={isLoading}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={fetchInsights}
      />

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Analyzing persistent expenses with AI...</Text>
        </View>
      ) : !result || result.summary.expense_count === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💡</Text>
          <Text style={styles.emptyTitle}>No expense data to analyze</Text>
          <Text style={styles.emptySubtitle}>
            Add some expenses or split a bill to generate AI spending insights and category breakdowns.
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
          {/* Metric Cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Spent</Text>
              <Text style={styles.metricValue}>
                ₹{result.summary.total_spending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Expenses</Text>
              <Text style={styles.metricValue}>{result.summary.expense_count}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg. Expense</Text>
              <Text style={styles.metricValue}>
                ₹{result.summary.average_expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Highest Category Callout */}
          {result.summary.highest_spending_category && (
            <View style={styles.highestCard}>
              <Text style={styles.highestLabel}>TOP SPENDING CATEGORY</Text>
              <View style={styles.highestRow}>
                <Text style={styles.highestCategory}>
                  {result.summary.highest_spending_category.category}
                </Text>
                <Text style={styles.highestAmount}>
                  ₹{result.summary.highest_spending_category.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                  ({result.summary.highest_spending_category.percentage}%)
                </Text>
              </View>
            </View>
          )}

          {/* Category Breakdown */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Category Breakdown</Text>
            {Object.entries(result.summary.spending_by_category).map(([cat, amt]) => {
              const pct = result.summary.category_percentages[cat] || 0;
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
          {result.insights && result.insights.length > 0 && (
            <View style={styles.insightsCard}>
              <View style={styles.insightsHeader}>
                <Text style={styles.insightsTitle}>💡 AI Spending Observations</Text>
              </View>
              {result.insights.map((insight, idx) => (
                <View key={idx} style={styles.insightItem}>
                  <Text style={styles.insightBullet}>•</Text>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
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
    padding: 20,
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
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    maxWidth: 260,
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  refreshButtonText: {
    fontSize: 18,
    color: "#475569",
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
    marginTop: 6,
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
    padding: 10,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  highestCard: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  highestLabel: {
    fontSize: 10,
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
    fontSize: 14,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  highestAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  breakdownCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  categoryPct: {
    fontSize: 11,
    color: "#64748b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryAmt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  insightsCard: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
  },
  insightsHeader: {
    marginBottom: 8,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e40af",
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  insightBullet: {
    fontSize: 14,
    color: "#2563eb",
    marginRight: 6,
    lineHeight: 18,
  },
  insightText: {
    fontSize: 13,
    color: "#1e3a8a",
    lineHeight: 18,
    flex: 1,
  },
});
