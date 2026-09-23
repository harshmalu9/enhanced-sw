import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getExpenses, getBudgetStatus, detectAnomalies, ApiError } from "../services/api";
import { ExpenseRecord } from "../types/expense";
import { BudgetStatus } from "../types/budget";
import { AnomalyDetectionResponse } from "../types/anomaly";

interface DashboardViewProps {
  onNavigate: (tab: "split" | "add" | "history" | "insights" | "budget" | "settlement") => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [expRes, budgetRes, anomalyRes] = await Promise.all([
        getExpenses().catch(() => ({ data: [] })),
        getBudgetStatus().catch(() => null),
        detectAnomalies(2.0).catch(() => null),
      ]);

      setExpenses(expRes.data || []);
      setBudgetStatus(budgetRes);
      setAnomalies(anomalyRes);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load dashboard overview.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalSpentAll = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome Banner */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <Text style={styles.welcomeGreeting}>Financial Overview</Text>
          <TouchableOpacity onPress={loadDashboardData} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeSubtitle}>
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </Text>

        <View style={styles.summaryStatsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statColLabel}>Total Recorded Spend</Text>
            <Text style={styles.statColValue}>
              ₹{totalSpentAll.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statColLabel}>Transactions</Text>
            <Text style={styles.statColValue}>{expenses.length}</Text>
          </View>
        </View>
      </View>

      {/* Budget Snapshot */}
      {budgetStatus && (
        <TouchableOpacity
          style={styles.budgetCard}
          onPress={() => onNavigate("budget")}
          activeOpacity={0.8}
        >
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetCardTitle}>🎯 Monthly Budget Progress</Text>
            <Text
              style={[
                styles.budgetStatusBadge,
                budgetStatus.status === "EXCEEDED"
                  ? styles.badgeRed
                  : budgetStatus.status === "WARNING"
                  ? styles.badgeAmber
                  : styles.badgeGreen,
              ]}
            >
              {budgetStatus.percentageUsed.toFixed(0)}% Used
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(budgetStatus.percentageUsed, 100)}%`,
                  backgroundColor:
                    budgetStatus.status === "EXCEEDED"
                      ? "#dc2626"
                      : budgetStatus.status === "WARNING"
                      ? "#d97706"
                      : "#16a34a",
                },
              ]}
            />
          </View>
          <View style={styles.budgetFooter}>
            <Text style={styles.budgetFooterText}>
              Spent: ₹{budgetStatus.totalSpent.toLocaleString("en-IN")} / ₹{budgetStatus.monthlyBudget.toLocaleString("en-IN")}
            </Text>
            <Text style={styles.budgetLinkText}>View Details →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Anomaly Callout Banner */}
      {anomalies && anomalies.anomalies_detected_count > 0 && (
        <TouchableOpacity
          style={styles.anomalyBanner}
          onPress={() => onNavigate("insights")}
          activeOpacity={0.8}
        >
          <Text style={styles.anomalyIcon}>🚨</Text>
          <View style={styles.anomalyBannerTextWrapper}>
            <Text style={styles.anomalyBannerTitle}>
              {anomalies.anomalies_detected_count} Spending Anomalies Detected
            </Text>
            <Text style={styles.anomalyBannerSubtitle}>
              Statistical models flagged unusual spending above typical baselines.
            </Text>
          </View>
          <Text style={styles.anomalyArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Quick Action Navigation Grid */}
      <Text style={styles.sectionHeader}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate("split")}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🧾</Text>
          <Text style={styles.actionTitle}>Split a Bill</Text>
          <Text style={styles.actionDesc}>OCR receipt & AI item share calculations</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate("add")}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>➕</Text>
          <Text style={styles.actionTitle}>Add Expense</Text>
          <Text style={styles.actionDesc}>Instant AI category classification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate("insights")}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>💡</Text>
          <Text style={styles.actionTitle}>AI Insights</Text>
          <Text style={styles.actionDesc}>Prophet forecasting & spending trends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => onNavigate("settlement")}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>🤝</Text>
          <Text style={styles.actionTitle}>Group Settlement</Text>
          <Text style={styles.actionDesc}>Simplify multi-payer debts</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Expenses Snapshot */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionHeader}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => onNavigate("history")}>
            <Text style={styles.seeAllText}>See All ({expenses.length}) →</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 16 }} />
        ) : expenses.length === 0 ? (
          <View style={styles.noDataCard}>
            <Text style={styles.noDataText}>No expenses recorded yet.</Text>
            <TouchableOpacity onPress={() => onNavigate("add")} style={styles.addFirstBtn}>
              <Text style={styles.addFirstBtnText}>+ Add First Expense</Text>
            </TouchableOpacity>
          </View>
        ) : (
          expenses.slice(0, 4).map((exp) => (
            <View key={exp.id} style={styles.recentItem}>
              <View style={styles.recentLeft}>
                <Text style={styles.recentDesc} numberOfLines={1}>{exp.description}</Text>
                <Text style={styles.recentMeta}>
                  {exp.category} • {exp.date}
                </Text>
              </View>
              <Text style={styles.recentAmount}>
                ₹{exp.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  welcomeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  welcomeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeGreeting: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 12,
  },
  refreshBtn: {
    padding: 4,
  },
  refreshBtnText: {
    fontSize: 16,
    color: "#64748b",
  },
  summaryStatsRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#e2e8f0",
  },
  statColLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 2,
  },
  statColValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  budgetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  budgetCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  budgetStatusBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: "#dcfce7",
    color: "#16a34a",
  },
  badgeAmber: {
    backgroundColor: "#fef3c7",
    color: "#d97706",
  },
  badgeRed: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetFooterText: {
    fontSize: 11,
    color: "#64748b",
  },
  budgetLinkText: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
  },
  anomalyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  anomalyIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  anomalyBannerTextWrapper: {
    flex: 1,
  },
  anomalyBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#c2410c",
  },
  anomalyBannerSubtitle: {
    fontSize: 11,
    color: "#9a3412",
    marginTop: 1,
  },
  anomalyArrow: {
    fontSize: 16,
    color: "#c2410c",
    fontWeight: "700",
    marginLeft: 6,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  actionCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 14,
  },
  recentSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  recentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  seeAllText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recentLeft: {
    flex: 1,
    marginRight: 10,
  },
  recentDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  recentMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  noDataCard: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noDataText: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
  },
  addFirstBtn: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addFirstBtnText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
});
