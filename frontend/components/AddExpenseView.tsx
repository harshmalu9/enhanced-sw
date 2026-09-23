import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createExpense, ApiError } from "../services/api";
import { ExpenseRecord } from "../types/expense";
import { ErrorBanner } from "./ErrorBanner";

interface AddExpenseViewProps {
  onExpenseSaved?: (expense: ExpenseRecord) => void;
}

export const AddExpenseView: React.FC<AddExpenseViewProps> = ({ onExpenseSaved }) => {
  const todayStr = new Date().toISOString().split("T")[0];

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayStr);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<ExpenseRecord | null>(null);

  const handleSave = async () => {
    if (!description.trim()) {
      setError("Please enter an expense description.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setLastSaved(null);

    try {
      const response = await createExpense({
        description: description.trim(),
        amount: parsedAmount,
        merchant: merchant.trim() ? merchant.trim() : undefined,
        date: date.trim() ? date.trim() : undefined,
      });

      setLastSaved(response.data);
      setDescription("");
      setAmount("");
      setMerchant("");
      setDate(todayStr);

      if (onExpenseSaved) {
        onExpenseSaved(response.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save expense. Please check your network and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = description.trim().length > 0 && amount.trim().length > 0 && !isLoading;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Add Expense</Text>
      <Text style={styles.subtitle}>
        Enter expense details. Our AI will automatically categorize and persist it to your local database.
      </Text>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={handleSave}
      />

      {lastSaved && (
        <View style={styles.savedBanner}>
          <Text style={styles.savedTitle}>✓ Expense Saved & Auto-Categorized!</Text>
          <Text style={styles.savedDetails}>
            "{lastSaved.description}" — ₹{lastSaved.amount.toFixed(2)}
          </Text>
          <View style={styles.categoryBadgeRow}>
            <Text style={styles.categoryBadgeLabel}>Assigned Category:</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{lastSaved.category}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Description Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Description <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Lunch at Chipotle, Metro card recharge, Running shoes"
          placeholderTextColor="#94a3b8"
          value={description}
          onChangeText={setDescription}
          editable={!isLoading}
        />
      </View>

      {/* Amount Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Amount (₹) <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 450.00"
          placeholderTextColor="#94a3b8"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          editable={!isLoading}
        />
      </View>

      {/* Merchant Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Merchant / Store (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Starbucks, Uber, Reliance Fresh"
          placeholderTextColor="#94a3b8"
          value={merchant}
          onChangeText={setMerchant}
          editable={!isLoading}
        />
      </View>

      {/* Date Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          value={date}
          onChangeText={setDate}
          editable={!isLoading}
        />
      </View>

      {/* AI Auto-categorization info note */}
      <View style={styles.aiNote}>
        <Text style={styles.aiNoteIcon}>✨</Text>
        <Text style={styles.aiNoteText}>
          Automatic AI Categorization enabled: Category will be classified and assigned on save.
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, !isFormValid && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!isFormValid}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.saveButtonText}>AI Categorizing & Saving...</Text>
          </View>
        ) : (
          <Text style={styles.saveButtonText}>💾 Save Expense</Text>
        )}
      </TouchableOpacity>
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
  savedBanner: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  savedTitle: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  savedDetails: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  categoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  categoryBadgeLabel: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },
  categoryBadge: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "700",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  aiNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  aiNoteIcon: {
    fontSize: 16,
  },
  aiNoteText: {
    fontSize: 12,
    color: "#1e40af",
    lineHeight: 16,
    flex: 1,
  },
  saveButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
