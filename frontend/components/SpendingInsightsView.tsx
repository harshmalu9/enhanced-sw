import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getSpendingInsights, ApiError } from "../services/api";
import { ExpenseInput, SpendingInsightsDataResult } from "../types/spending";
import { ErrorBanner } from "./ErrorBanner";

const SAMPLE_EXPENSES_DATASET: ExpenseInput[] = [
  {
    description: "Pizza with friends",
    amount: 600,
    category: "Food & Dining",
    merchant: "Dominos",
    date: "2026-09-20",
  },
  {
    description: "Uber ride",
    amount: 450,
    category: "Transportation",
    merchant: "Uber",
    date: "2026-09-19",
  },
  {
    description: "New shoes",
    amount: 1500,
    category: "Shopping",
    merchant: "Nike",
    date: "2026-09-18",
  },
  {
    description: "Netflix subscription",
    amount: 499,
    category: "Entertainment",
    merchant: "Netflix",
    date: "2026-09-15",
  },
  {
    description: "Supermarket groceries",
    amount: 1200,
    category: "Groceries",
    merchant: "Reliance Fresh",
    date: "2026-09-14",
  },
];

export const SpendingInsightsView: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseInput[]>(SAMPLE_EXPENSES_DATASET);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpendingInsightsDataResult | null>(null);

  const handleAnalyze = async () => {
    if (!expenses || expenses.length === 0) {
      setError("Please add at least one expense to analyze.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await getSpendingInsights({
        expenses,
        period: {
          start: "2026-09-01",
          end: "2026-09-20",
        },
      });

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
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const handleLoadSample = (sample: ExpenseInput[]) => {
    setExpenses(sample);
    setResult(null);
    setError(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Spending Insights</Text>
      <Text style={styles.subtitle}>
        Deterministic financial breakdown paired with AI-generated spending patterns.
      </Text>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={handleAnalyze}
      />

      {/* Dataset Selection Controls */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sample Expense Dataset</Text>
        <Text style={styles.itemCountBadge}>{expenses.length} expenses</Text>
      </View>

      {/* Expense List Preview */}
      <View style={styles.expensePreviewList}>
        {expenses.map((item, idx) => (
          <View key={idx} style={styles.expensePreviewRow}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseDesc} numberOfLines={1}>
                {item.description}
              </Text>
              <Text style={styles.expenseCategory}>{item.category}</Text>
            </View>
            <Text style={styles.expenseAmount}>₹{item.amount.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.analyzeButton, isLoading && styles.buttonDisabled]}
        onPress={handleAnalyze}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.buttonText}>Analyzing Spending...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>⚡ Generate Spending Insights</Text>
        )}
      </TouchableOpacity>

      {/* Results Display */}
      {result && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsMainTitle}>Spending Summary</Text>
            <TouchableOpacity onPress={handleReset} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>

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
              <Text style={styles.metricLabel}>Average Expense</Text>
              <Text style={styles.metricValue}>
                ₹{result.summary.average_expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

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
                <Text style={styles.insightsTitle}>💡 AI Insights</Text>
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
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemCountBadge: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  expensePreviewList: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginBottom: 14,
  },
  expensePreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  expenseLeft: {
    flex: 1,
    marginRight: 8,
  },
  expenseDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  expenseCategory: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  analyzeButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resultsContainer: {
    marginTop: 18,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultsMainTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  clearBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  clearBtnText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
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
