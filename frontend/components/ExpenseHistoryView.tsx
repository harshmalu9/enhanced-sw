import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getExpenses, deleteExpense, ApiError } from "../services/api";
import { ExpenseRecord } from "../types/expense";
import { ErrorBanner } from "./ErrorBanner";

interface ExpenseHistoryViewProps {
  onNavigateToAdd?: () => void;
}

export const ExpenseHistoryView: React.FC<ExpenseHistoryViewProps> = ({ onNavigateToAdd }) => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getExpenses();
      setExpenses(response.data || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load expenses.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDelete = async (id: string, description: string) => {
    setDeletingId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      setSuccessMessage(`Deleted "${description}"`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to delete expense.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const totalSum = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Expense History</Text>
          <Text style={styles.subtitle}>
            All expenses stored persistently in your local database.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchExpenses}
          disabled={isLoading}
        >
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={fetchExpenses}
      />

      {successMessage && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ {successMessage}</Text>
        </View>
      )}

      {/* Summary Stat */}
      {expenses.length > 0 && (
        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>Total Recorded</Text>
            <Text style={styles.summaryAmount}>
              ₹{totalSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{expenses.length} items</Text>
          </View>
        </View>
      )}

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Loading expense history...</Text>
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No expenses recorded yet</Text>
          <Text style={styles.emptySubtitle}>
            Add manual expenses with automatic AI categorization, or split a bill to save your share!
          </Text>
          {onNavigateToAdd && (
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={onNavigateToAdd}
              activeOpacity={0.8}
            >
              <Text style={styles.addFirstButtonText}>➕ Add First Expense</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((expense) => {
            const isDeleting = deletingId === expense.id;
            return (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseMain}>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseDesc} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {expense.category}
                        </Text>
                      </View>
                      {expense.merchant && (
                        <Text style={styles.merchantText}>• {expense.merchant}</Text>
                      )}
                      <Text style={styles.dateText}>• {expense.date}</Text>
                    </View>
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountText}>
                      ₹{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(expense.id, expense.description)}
                      disabled={isDeleting}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Text style={styles.deleteButtonText}>✕ Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
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
  successBanner: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
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
  addFirstButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    gap: 8,
  },
  expenseItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  expenseMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expenseInfo: {
    flex: 1,
    marginRight: 10,
  },
  expenseDesc: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  merchantText: {
    fontSize: 11,
    color: "#64748b",
  },
  dateText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  amountCol: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  deleteButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  deleteButtonText: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "600",
  },
});
