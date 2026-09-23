import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BudgetStatus, CategoryBudgetStatus, UpsertBudgetPayload } from "../types/budget";
import { getBudgetStatus, setBudget, ApiError } from "../services/api";

const CANONICAL_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Personal Care",
  "Other",
];

interface BudgetViewProps {
  onNavigateToAdd?: () => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ onNavigateToAdd }) => {
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form states
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState<string>("");
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});

  const fetchBudget = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBudgetStatus();
      setStatus(data);
      if (data) {
        setMonthlyBudgetInput(String(data.monthlyBudget));
        const catMap: Record<string, string> = {};
        data.categoryStatuses.forEach((c) => {
          catMap[c.category] = String(c.budgetLimit);
        });
        setCategoryInputs(catMap);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load budget status.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleOpenEdit = () => {
    if (status) {
      setMonthlyBudgetInput(String(status.monthlyBudget));
      const catMap: Record<string, string> = {};
      status.categoryStatuses.forEach((c) => {
        catMap[c.category] = String(c.budgetLimit);
      });
      setCategoryInputs(catMap);
    } else {
      setMonthlyBudgetInput("30000");
      setCategoryInputs({
        "Food & Dining": "6000",
        "Groceries": "5000",
        "Transportation": "3000",
        "Shopping": "4000",
        "Bills & Utilities": "4000",
      });
    }
    setIsModalVisible(true);
  };

  const handleSaveBudget = async () => {
    const monthlyAmt = parseFloat(monthlyBudgetInput);
    if (isNaN(monthlyAmt) || monthlyAmt <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid positive monthly budget amount.");
      return;
    }

    const catBudgets: Record<string, number> = {};
    for (const [cat, val] of Object.entries(categoryInputs)) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0) {
        catBudgets[cat] = parsed;
      }
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    setIsSaving(true);
    try {
      const payload: UpsertBudgetPayload = {
        monthYear: currentMonth,
        monthlyBudget: monthlyAmt,
        categoryBudgets: catBudgets,
      };

      const newStatus = await setBudget(payload);
      setStatus(newStatus);
      setIsModalVisible(false);
      Alert.alert("Success", "Budget updated successfully.");
    } catch (err: unknown) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to save budget."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (st: "NORMAL" | "WARNING" | "EXCEEDED") => {
    switch (st) {
      case "NORMAL":
        return "#16a34a"; // green
      case "WARNING":
        return "#d97706"; // amber
      case "EXCEEDED":
        return "#dc2626"; // red
    }
  };

  const getStatusBadgeText = (st: "NORMAL" | "WARNING" | "EXCEEDED") => {
    switch (st) {
      case "NORMAL":
        return "✓ On Track";
      case "WARNING":
        return "⚠ Near Limit (80%+)";
      case "EXCEEDED":
        return "🚨 Budget Exceeded";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.viewTitle}>Monthly Budget & Limits</Text>
          <Text style={styles.viewSubtitle}>
            Deterministic progress tracking against monthly spending targets
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleOpenEdit}
          activeOpacity={0.8}
        >
          <Text style={styles.editButtonText}>⚙ {status ? "Edit Budget" : "Set Budget"}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Calculating budget metrics...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBudget}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !status ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>No Budget Configured</Text>
          <Text style={styles.emptySubtitle}>
            Set your monthly spending target and optional category limits to track your finances deterministically.
          </Text>
          <TouchableOpacity style={styles.primaryActionButton} onPress={handleOpenEdit}>
            <Text style={styles.primaryActionText}>+ Set Monthly Budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Main Monthly Gauge Card */}
          <View style={styles.gaugeCard}>
            <View style={styles.gaugeHeader}>
              <View>
                <Text style={styles.monthLabel}>
                  {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
                </Text>
                <Text style={styles.monthlyLimitText}>
                  Target: ₹{status.monthlyBudget.toLocaleString("en-IN")}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${getStatusColor(status.status)}18` },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: getStatusColor(status.status) },
                  ]}
                >
                  {getStatusBadgeText(status.status)}
                </Text>
              </View>
            </View>

            {/* Spent vs Remaining */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Spent So Far</Text>
                <Text style={styles.metricValueSpent}>
                  ₹{status.totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {status.remainingAmount >= 0 ? "Remaining" : "Over Budget By"}
                </Text>
                <Text
                  style={[
                    styles.metricValueRemaining,
                    status.remainingAmount < 0 && { color: "#dc2626" },
                  ]}
                >
                  ₹{Math.abs(status.remainingAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Main Progress Bar */}
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(status.percentageUsed, 100)}%`,
                    backgroundColor: getStatusColor(status.status),
                  },
                ]}
              />
            </View>

            <View style={styles.progressFooter}>
              <Text style={styles.progressFooterText}>
                {status.percentageUsed.toFixed(1)}% used
              </Text>
              <Text style={styles.progressFooterText}>
                {status.remainingAmount >= 0
                  ? `₹${status.remainingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} left`
                  : `₹${Math.abs(status.remainingAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} exceeded`}
              </Text>
            </View>
          </View>

          {/* Category Budgets Breakdown */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Category Budget Allocations</Text>
            <Text style={styles.sectionSubtitle}>
              Progress against specific category limits this month
            </Text>

            {status.categoryStatuses.length === 0 ? (
              <Text style={styles.noCategoriesText}>
                No category-specific limits configured. Tap "Edit Budget" to set category caps.
              </Text>
            ) : (
              status.categoryStatuses.map((catStatus: CategoryBudgetStatus) => (
                <View key={catStatus.category} style={styles.categoryRow}>
                  <View style={styles.catHeader}>
                    <Text style={styles.catName}>{catStatus.category}</Text>
                    <Text style={styles.catSpentText}>
                      ₹{catStatus.spent.toLocaleString("en-IN")} / ₹{catStatus.budgetLimit.toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={styles.catProgressBarBg}>
                    <View
                      style={[
                        styles.catProgressBarFill,
                        {
                          width: `${Math.min(catStatus.percentageUsed, 100)}%`,
                          backgroundColor: getStatusColor(catStatus.status),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.catFooter}>
                    <Text
                      style={[
                        styles.catStatusText,
                        { color: getStatusColor(catStatus.status) },
                      ]}
                    >
                      {catStatus.status === "EXCEEDED"
                        ? `🚨 Exceeded by ₹${Math.abs(catStatus.remainingAmount).toLocaleString("en-IN")}`
                        : catStatus.status === "WARNING"
                        ? `⚠ ${catStatus.percentageUsed.toFixed(0)}% used (₹${catStatus.remainingAmount.toLocaleString("en-IN")} left)`
                        : `✓ ${catStatus.percentageUsed.toFixed(0)}% used (₹${catStatus.remainingAmount.toLocaleString("en-IN")} left)`}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Edit / Set Budget Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Monthly Budget</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Total Monthly Budget (₹) *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="e.g. 30000"
                value={monthlyBudgetInput}
                onChangeText={setMonthlyBudgetInput}
              />

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                Optional Category Allocations (₹)
              </Text>
              <Text style={styles.helperText}>
                Set specific spending limits for categories you want to restrict.
              </Text>

              {CANONICAL_CATEGORIES.map((cat) => (
                <View key={cat} style={styles.catInputRow}>
                  <Text style={styles.catInputLabel}>{cat}</Text>
                  <TextInput
                    style={styles.catTextInput}
                    keyboardType="numeric"
                    placeholder="None"
                    value={categoryInputs[cat] || ""}
                    onChangeText={(val) =>
                      setCategoryInputs((prev) => ({ ...prev, [cat]: val }))
                    }
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.btnDisabled]}
                onPress={handleSaveBudget}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Budget</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  viewSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  editButton: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  primaryActionButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
  },
  gaugeCard: {
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
    marginBottom: 16,
  },
  gaugeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  monthlyLimitText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  metricValueSpent: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  metricValueRemaining: {
    fontSize: 18,
    fontWeight: "700",
    color: "#16a34a",
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 14,
  },
  noCategoriesText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  categoryRow: {
    marginBottom: 14,
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  catSpentText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  catProgressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  catProgressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  catFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  catStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    maxHeight: "85%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: "#64748b",
  },
  modalScroll: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  helperText: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: "#0f172a",
  },
  catInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  catInputLabel: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  catTextInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 110,
    textAlign: "right",
    fontSize: 13,
    color: "#0f172a",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
