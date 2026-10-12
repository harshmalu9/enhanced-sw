import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Shapes, Typography } from "../constants/theme";
import { getExpenses, createExpense, deleteExpense, ApiError } from "../services/api";
import { ExpenseRecord } from "../types/expense";
import { CategoryIcon } from "./CategoryIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { DateSelector } from "./DateSelector";
import { MaterialBottomSheet } from "./MaterialBottomSheet";

const CANONICAL_CATEGORIES = [
  "All",
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Healthcare",
  "Education",
  "Travel",
  "Personal Care",
  "Other",
];

interface ExpensesScreenProps {
  isAddExpenseOpen: boolean;
  onCloseAddExpense: () => void;
  onOpenAddExpense: () => void;
  onDataMutated: () => void;
  refreshTrigger?: number;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({
  isAddExpenseOpen,
  onCloseAddExpense,
  onOpenAddExpense,
  onDataMutated,
  refreshTrigger = 0,
}) => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Add Expense form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog state
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback banner state
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await getExpenses();
      setExpenses(response.data || []);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshTrigger]);

  const handlePullRefresh = () => {
    setIsRefreshing(true);
    fetchExpenses();
  };

  const handleSaveExpense = async () => {
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setFormError("Please enter an expense description.");
      return;
    }

    const parsedAmount = parseFloat(amount.trim());
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid positive amount.");
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const res = await createExpense({
        description: trimmedDesc,
        amount: parsedAmount,
        merchant: merchant.trim() ? merchant.trim() : undefined,
        date: date.trim() ? date.trim() : undefined,
      });

      setDescription("");
      setAmount("");
      setMerchant("");
      setDate(new Date().toISOString().split("T")[0]);
      onCloseAddExpense();

      // Show specific feedback message
      setFeedbackMessage(`₹${res.data.amount.toFixed(2)} added to ${res.data.category}`);
      setTimeout(() => setFeedbackMessage(null), 4000);

      onDataMutated();
      fetchExpenses();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to save expense. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;

    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseToDelete.id));
      setExpenseToDelete(null);

      setFeedbackMessage("Expense deleted.");
      setTimeout(() => setFeedbackMessage(null), 3000);

      onDataMutated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete expense.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter expenses based on search & category
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.merchant && exp.merchant.toLowerCase().includes(searchQuery.toLowerCase())) ||
        exp.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        exp.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, selectedCategory]);

  // Group by Date sections (Today, Yesterday, Month Year)
  const groupedSections = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yestDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yestDate.toISOString().split("T")[0];

    const groups: Record<string, ExpenseRecord[]> = {};

    filteredExpenses.forEach((exp) => {
      let sectionKey = exp.date || "Earlier";
      if (exp.date === todayStr) {
        sectionKey = "Today";
      } else if (exp.date === yesterdayStr) {
        sectionKey = "Yesterday";
      } else if (exp.date) {
        try {
          const parts = exp.date.split("-");
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
          sectionKey = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        } catch {
          sectionKey = exp.date;
        }
      }

      if (!groups[sectionKey]) {
        groups[sectionKey] = [];
      }
      groups[sectionKey].push(exp);
    });

    return Object.entries(groups);
  }, [filteredExpenses]);

  const totalFilteredSum = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const formatCurrency = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      {/* Search and Category Filter Header */}
      <View style={styles.topControlSection}>
        <View style={styles.searchBarContainer}>
          <MaterialIcons name="search" size={20} color={Colors.secondaryText} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchants, items, categories..."
            placeholderTextColor={Colors.tertiaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearchButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="cancel" size={18} color={Colors.tertiaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CANONICAL_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryFilterChip,
                  isSelected && styles.categoryFilterChipSelected,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryFilterText,
                    isSelected && styles.categoryFilterTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Optional Feedback Toast */}
      {feedbackMessage && (
        <View style={styles.feedbackBanner}>
          <MaterialIcons name="check-circle" size={16} color={Colors.success} />
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      )}

      {/* Main Expense Ledger List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="receipt-long"
          title="No expenses recorded yet"
          message="Record your first expense or split a restaurant bill to begin tracking."
          actionLabel="Add Expense"
          onAction={onOpenAddExpense}
        />
      ) : filteredExpenses.length === 0 ? (
        <EmptyState
          icon="search-off"
          title="No matching transactions"
          message={`No expenses found matching "${searchQuery}".`}
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery("");
            setSelectedCategory("All");
          }}
        />
      ) : (
        <ScrollView
          style={styles.ledgerScroll}
          contentContainerStyle={styles.ledgerContent}
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
          {/* Action Row & Summary Metric Header */}
          <View style={styles.tallyHeader}>
            <View>
              <Text style={styles.tallyCount}>
                {filteredExpenses.length} transaction{filteredExpenses.length === 1 ? "" : "s"}
                {selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}
              </Text>
              <Text style={styles.tallyAmount}>{formatCurrency(totalFilteredSum)}</Text>
            </View>

            <TouchableOpacity
              style={styles.addExpenseTriggerBtn}
              onPress={onOpenAddExpense}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={18} color={Colors.onPrimary} />
              <Text style={styles.addExpenseTriggerBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>

          {groupedSections.map(([sectionTitle, items]) => (
            <View key={sectionTitle} style={styles.sectionGroup}>
              <Text style={styles.sectionHeaderTitle}>{sectionTitle}</Text>
              <View style={styles.sectionCard}>
                {items.map((exp, idx) => (
                  <View
                    key={exp.id}
                    style={[
                      styles.expenseRow,
                      idx < items.length - 1 && styles.expenseRowBorder,
                    ]}
                  >
                    <CategoryIcon category={exp.category} size={40} iconSize={20} />

                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseDesc} numberOfLines={1}>
                        {exp.description}
                      </Text>
                      <Text style={styles.expenseMeta}>
                        {exp.category} {exp.merchant ? `• ${exp.merchant}` : ""}
                      </Text>
                    </View>

                    <View style={styles.amountCol}>
                      <Text style={styles.expenseAmount}>{formatCurrency(exp.amount)}</Text>
                      <TouchableOpacity
                        onPress={() => setExpenseToDelete(exp)}
                        style={styles.deleteIconButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialIcons name="delete-outline" size={18} color={Colors.tertiaryText} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={expenseToDelete !== null}
        title="Delete this expense?"
        message={
          expenseToDelete
            ? `Delete "${expenseToDelete.description}" (${formatCurrency(expenseToDelete.amount)})? This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setExpenseToDelete(null)}
      />

      {/* Add Expense Animated Bottom Sheet with Centered Cross Button */}
      <MaterialBottomSheet
        visible={isAddExpenseOpen}
        onClose={onCloseAddExpense}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Expense</Text>
          <Text style={styles.modalSubtitle}>
            Details will be automatically categorized
          </Text>
        </View>

        {formError && (
          <View style={styles.formErrorBanner}>
            <MaterialIcons name="error-outline" size={16} color={Colors.error} />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <ScrollView
          style={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Description <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Lunch at Chipotle, Metro recharge"
              placeholderTextColor={Colors.tertiaryText}
              value={description}
              onChangeText={(val) => {
                setDescription(val);
                if (formError) setFormError(null);
              }}
              autoFocus={true}
            />
          </View>

          {/* Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Amount (₹) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 450.00"
              placeholderTextColor={Colors.tertiaryText}
              value={amount}
              onChangeText={(val) => {
                setAmount(val);
                if (formError) setFormError(null);
              }}
              keyboardType="numeric"
            />
          </View>

          {/* Merchant */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Merchant / Store (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Starbucks, Uber, Reliance"
              placeholderTextColor={Colors.tertiaryText}
              value={merchant}
              onChangeText={setMerchant}
            />
          </View>

          {/* Date Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date</Text>
            <DateSelector selectedDate={date} onSelectDate={setDate} />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.saveExpenseButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveExpense}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <Text style={styles.saveExpenseButtonText}>Save Expense</Text>
            )}
          </TouchableOpacity>
        </View>
      </MaterialBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topControlSection: {
    backgroundColor: Colors.surface,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusMd,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.primaryText,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  categoryFilterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryFilterText: {
    ...Typography.labelMedium,
    color: Colors.secondaryText,
    fontSize: 12,
  },
  categoryFilterTextSelected: {
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  feedbackText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ledgerScroll: {
    flex: 1,
  },
  ledgerContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tallyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  tallyCount: {
    ...Typography.labelMedium,
    color: Colors.secondaryText,
  },
  tallyAmount: {
    ...Typography.amountMedium,
    color: Colors.primaryText,
    fontSize: 18,
    marginTop: 2,
  },
  addExpenseTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Shapes.radiusSm,
  },
  addExpenseTriggerBtnText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontSize: 13,
  },
  sectionGroup: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    ...Typography.titleSmall,
    fontSize: 12,
    color: Colors.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    overflow: "hidden",
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  expenseRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  expenseInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  expenseDesc: {
    ...Typography.bodyLarge,
    fontWeight: "600",
    color: Colors.primaryText,
    fontSize: 14,
  },
  expenseMeta: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  amountCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  expenseAmount: {
    ...Typography.amountMedium,
    fontSize: 15,
    color: Colors.primaryText,
  },
  deleteIconButton: {
    padding: 2,
  },
  modalHeader: {
    marginBottom: 14,
  },
  modalTitle: {
    ...Typography.titleLarge,
    fontSize: 18,
    color: Colors.primaryText,
  },
  modalSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.errorContainer,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  formErrorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: "500",
    flex: 1,
  },
  formScroll: {
    maxHeight: 380,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    ...Typography.labelLarge,
    fontSize: 13,
    color: Colors.primaryText,
    marginBottom: 6,
  },
  requiredStar: {
    color: Colors.error,
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusMd,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.primaryText,
    backgroundColor: Colors.surfaceVariant,
  },
  modalFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
  },
  saveExpenseButton: {
    backgroundColor: Colors.primary,
    borderRadius: Shapes.radiusMd,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveExpenseButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
});
