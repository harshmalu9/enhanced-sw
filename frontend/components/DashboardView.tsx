import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Elevation, Shapes, Typography } from "../constants/theme";
import { getExpenses, getBudgetStatus, detectAnomalies, seedDemoData } from "../services/api";
import { ExpenseRecord } from "../types/expense";
import { BudgetStatus } from "../types/budget";
import { AnomalyDetectionResponse } from "../types/anomaly";
import { CategoryIcon } from "./CategoryIcon";
import { BudgetModal } from "./BudgetModal";

interface DashboardViewProps {
  onNavigateToTab: (tab: "expenses" | "split" | "insights") => void;
  onOpenAddExpense: () => void;
  refreshTrigger?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTab,
  onOpenAddExpense,
  refreshTrigger = 0,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse | null>(null);
  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [expRes, budgetRes, anomalyRes] = await Promise.all([
        getExpenses().catch(() => ({ data: [] })),
        getBudgetStatus().catch(() => null),
        detectAnomalies(2.0).catch(() => null),
      ]);

      setExpenses(expRes.data || []);
      setBudgetStatus(budgetRes);
      setAnomalies(anomalyRes);
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

  const handleSeedSampleData = async () => {
    setIsSeeding(true);
    try {
      await seedDemoData();
      await loadData();
    } catch {
      // error handled
    } finally {
      setIsSeeding(false);
    }
  };

  const totalSpentAll = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Month-to-date calculation
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthExpenses = expenses.filter((e) => e.date?.startsWith(currentMonthPrefix));
  const currentMonthSpent = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const formatCurrency = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyWhole = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const renderQuickAction = (
    label: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    onPress: () => void,
    isPrimary: boolean
  ) => {
    const content = (
      <View
        style={[
          styles.actionButtonInner,
          isPrimary ? styles.actionPrimaryInner : styles.actionSecondaryInner,
        ]}
      >
        <MaterialIcons
          name={icon}
          size={20}
          color={isPrimary ? Colors.onPrimary : Colors.primary}
        />
        <Text
          style={[
            styles.actionButtonText,
            isPrimary ? styles.actionPrimaryText : styles.actionSecondaryText,
          ]}
        >
          {label}
        </Text>
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View style={styles.actionButtonWrapper}>
          <TouchableNativeFeedback
            onPress={onPress}
            background={TouchableNativeFeedback.Ripple(
              isPrimary ? Colors.rippleLight : Colors.ripple,
              false
            )}
          >
            {content}
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.actionButtonWrapper}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  };

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
      {/* 1. Hero Spending Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroMonthLabel}>
            {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
          <TouchableOpacity
            onPress={() => setIsBudgetModalVisible(true)}
            style={styles.heroBudgetLink}
            activeOpacity={0.7}
          >
            <MaterialIcons name="tune" size={14} color={Colors.secondary} />
            <Text style={styles.heroBudgetLinkText}>
              {budgetStatus ? "Edit Budget" : "Set Budget"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroAmountLabel}>This Month's Spending</Text>
        <Text style={styles.heroAmountValue}>
          {formatCurrency(budgetStatus ? budgetStatus.totalSpent : currentMonthSpent)}
        </Text>

        <View style={styles.heroDivider} />

        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetricItem}>
            <Text style={styles.heroMetricLabel}>Monthly Budget</Text>
            <Text style={styles.heroMetricValue}>
              {budgetStatus ? formatCurrencyWhole(budgetStatus.monthlyBudget) : "Not set"}
            </Text>
          </View>

          <View style={styles.heroMetricDivider} />

          <View style={styles.heroMetricItem}>
            <Text style={styles.heroMetricLabel}>
              {budgetStatus && budgetStatus.remainingAmount < 0 ? "Over Budget" : "Remaining"}
            </Text>
            <Text
              style={[
                styles.heroMetricValue,
                budgetStatus && budgetStatus.remainingAmount < 0
                  ? { color: "#FCA5A5" }
                  : { color: Colors.secondary },
              ]}
            >
              {budgetStatus
                ? formatCurrency(Math.abs(budgetStatus.remainingAmount))
                : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Budget Progress Bar */}
      {budgetStatus && (
        <View style={styles.budgetProgressCard}>
          <View style={styles.budgetHeaderRow}>
            <Text style={styles.budgetStatusText}>
              {budgetStatus.status === "EXCEEDED"
                ? "Budget limit exceeded"
                : budgetStatus.status === "WARNING"
                ? "Approaching monthly limit"
                : "Spending is on track"}
            </Text>
            <Text style={styles.budgetPercentText}>
              {budgetStatus.percentageUsed.toFixed(0)}% used
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(budgetStatus.percentageUsed, 100)}%`,
                  backgroundColor:
                    budgetStatus.status === "EXCEEDED"
                      ? Colors.error
                      : budgetStatus.status === "WARNING"
                      ? Colors.warning
                      : Colors.success,
                },
              ]}
            />
          </View>

          <Text style={styles.budgetHumanNote}>
            {budgetStatus.remainingAmount >= 0
              ? `${formatCurrency(budgetStatus.remainingAmount)} remaining for the next ${
                  new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
                } days.`
              : `You have spent ${formatCurrency(
                  Math.abs(budgetStatus.remainingAmount)
                )} more than your monthly target.`}
          </Text>
        </View>
      )}

      {/* 3. Conditional Alert Banner (Only when genuine anomalies or over-budget exist) */}
      {anomalies && anomalies.anomalies_detected_count > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => onNavigateToTab("insights")}
          activeOpacity={0.8}
        >
          <View style={styles.alertIconCircle}>
            <MaterialIcons name="notifications-active" size={18} color={Colors.warning} />
          </View>
          <View style={styles.alertTextWrapper}>
            <Text style={styles.alertTitle}>Spending Notice</Text>
            <Text style={styles.alertMessage}>
              {anomalies.anomalies_detected_count === 1
                ? "1 unusual transaction was flagged higher than usual."
                : `${anomalies.anomalies_detected_count} transactions are noticeably higher than your category averages.`}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.secondaryText} />
        </TouchableOpacity>
      )}

      {/* 4. Quick Actions */}
      <View style={styles.quickActionsRow}>
        {renderQuickAction("Add Expense", "add", onOpenAddExpense, true)}
        {renderQuickAction(
          "Split a Bill",
          "call-split",
          () => onNavigateToTab("split"),
          false
        )}
      </View>

      {/* 5. Recent Expenses Ledger */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {expenses.length > 0 && (
          <TouchableOpacity
            onPress={() => onNavigateToTab("expenses")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewLedgerLink}>View Ledger</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.emptyRecentCard}>
          <Text style={styles.emptyRecentTitle}>No transactions yet</Text>
          <Text style={styles.emptyRecentText}>
            Add your first expense or split a bill to start tracking.
          </Text>
          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={onOpenAddExpense}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={16} color={Colors.onPrimary} />
              <Text style={styles.emptyAddBtnText}>Add Expense</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emptySeedBtn}
              onPress={handleSeedSampleData}
              disabled={isSeeding}
              activeOpacity={0.8}
            >
              {isSeeding ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <MaterialIcons name="restore" size={16} color={Colors.primary} />
                  <Text style={styles.emptySeedBtnText}>Load Sample Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.recentList}>
          {expenses.slice(0, 4).map((exp) => (
            <TouchableOpacity
              key={exp.id}
              style={styles.recentItem}
              onPress={() => onNavigateToTab("expenses")}
              activeOpacity={0.7}
            >
              <CategoryIcon category={exp.category} size={40} iconSize={20} />
              <View style={styles.recentMiddle}>
                <Text style={styles.recentDescription} numberOfLines={1}>
                  {exp.description}
                </Text>
                <Text style={styles.recentMeta}>
                  {exp.category} {exp.merchant ? `• ${exp.merchant}` : ""} • {exp.date}
                </Text>
              </View>
              <Text style={styles.recentAmount}>{formatCurrency(exp.amount)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Budget Modal */}
      <BudgetModal
        visible={isBudgetModalVisible}
        currentBudget={budgetStatus}
        onClose={() => setIsBudgetModalVisible(false)}
        onBudgetUpdated={(newStatus) => {
          setBudgetStatus(newStatus);
          loadData();
        }}
      />
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
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: Colors.primary, // Emerald Ink
    borderRadius: Shapes.radiusLg,
    padding: 20,
    marginBottom: 12,
    ...Elevation.level2,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  heroMonthLabel: {
    ...Typography.labelMedium,
    color: Colors.secondary, // Champagne
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroBudgetLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Shapes.radiusSm,
    backgroundColor: "rgba(248, 231, 201, 0.15)",
  },
  heroBudgetLinkText: {
    ...Typography.bodySmall,
    color: Colors.secondary,
    fontWeight: "600",
    fontSize: 11,
  },
  heroAmountLabel: {
    ...Typography.bodySmall,
    color: "rgba(255, 255, 255, 0.75)",
    marginBottom: 2,
  },
  heroAmountValue: {
    ...Typography.headlineLarge,
    fontSize: 28,
    color: Colors.onPrimary,
    fontWeight: "800",
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginVertical: 14,
  },
  heroMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMetricItem: {
    flex: 1,
  },
  heroMetricLabel: {
    ...Typography.labelSmall,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 2,
  },
  heroMetricValue: {
    ...Typography.titleMedium,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 12,
  },
  budgetProgressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 14,
    marginBottom: 12,
  },
  budgetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  budgetStatusText: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    fontWeight: "700",
  },
  budgetPercentText: {
    ...Typography.labelMedium,
    color: Colors.secondaryText,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceVariant,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  budgetHumanNote: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    lineHeight: 16,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningContainer,
    borderRadius: Shapes.radiusMd,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  alertIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTextWrapper: {
    flex: 1,
  },
  alertTitle: {
    ...Typography.labelLarge,
    color: Colors.warning,
    fontSize: 12,
  },
  alertMessage: {
    ...Typography.bodySmall,
    color: "#78350F",
    fontSize: 12,
    marginTop: 1,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  actionButtonWrapper: {
    flex: 1,
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
  },
  actionButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: Shapes.radiusMd,
  },
  actionPrimaryInner: {
    backgroundColor: Colors.primary,
  },
  actionSecondaryInner: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  actionButtonText: {
    ...Typography.labelLarge,
    fontSize: 13,
  },
  actionPrimaryText: {
    color: Colors.onPrimary,
  },
  actionSecondaryText: {
    color: Colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    ...Typography.titleLarge,
    fontSize: 16,
    color: Colors.primaryText,
  },
  viewLedgerLink: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: "700",
  },
  recentList: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    overflow: "hidden",
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  recentMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  recentDescription: {
    ...Typography.bodyLarge,
    fontWeight: "600",
    color: Colors.primaryText,
    fontSize: 14,
  },
  recentMeta: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  recentAmount: {
    ...Typography.amountMedium,
    fontSize: 15,
    color: Colors.primaryText,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyRecentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 24,
    alignItems: "center",
  },
  emptyRecentTitle: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    marginBottom: 4,
  },
  emptyRecentText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyActionsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Shapes.radiusSm,
  },
  emptyAddBtnText: {
    ...Typography.labelMedium,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  emptySeedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Shapes.radiusSm,
    minWidth: 130,
    justifyContent: "center",
  },
  emptySeedBtnText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: "600",
  },
});
