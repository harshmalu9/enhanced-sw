import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { categorizeExpense, ApiError } from "../services/api";
import { ExpenseCategoryResult } from "../types/expense";
import { ErrorBanner } from "./ErrorBanner";

export const ExpenseCategorizer: React.FC = () => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseCategoryResult | null>(null);

  const handleCategorize = async () => {
    if (!description.trim()) {
      setError("Please enter an expense description.");
      return;
    }

    let parsedAmount: number | undefined = undefined;
    if (amount.trim()) {
      parsedAmount = parseFloat(amount.trim());
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        setError("Please enter a valid non-negative amount.");
        return;
      }
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await categorizeExpense({
        description: description.trim(),
        amount: parsedAmount,
        merchant: merchant.trim() || undefined,
      });

      setResult(response.data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while categorizing the expense.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setDescription("");
    setAmount("");
    setMerchant("");
    setResult(null);
    setError(null);
  };

  const getConfidenceBadgeColor = (conf: string) => {
    switch (conf.toLowerCase()) {
      case "high":
        return { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" };
      case "medium":
        return { bg: "#fef9c3", text: "#a16207", border: "#fde047" };
      case "low":
        return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" };
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    }
  };

  const isButtonDisabled = !description.trim() || isLoading;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Expense Categorization</Text>
      <Text style={styles.subtitle}>
        Automatically classify your expenses with AI-powered category detection.
      </Text>

      <ErrorBanner
        message={error}
        onDismiss={() => setError(null)}
        onRetry={handleCategorize}
      />

      {/* Description Field */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Expense Description <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Uber ride from college to home"
          placeholderTextColor="#94a3b8"
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (error) setError(null);
          }}
          editable={!isLoading}
          multiline={false}
        />
      </View>

      {/* Amount Field (Optional) */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Amount <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 450"
          placeholderTextColor="#94a3b8"
          value={amount}
          onChangeText={(text) => {
            setAmount(text);
            if (error) setError(null);
          }}
          keyboardType="numeric"
          editable={!isLoading}
        />
      </View>

      {/* Merchant Field (Optional) */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Merchant <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Uber"
          placeholderTextColor="#94a3b8"
          value={merchant}
          onChangeText={(text) => {
            setMerchant(text);
            if (error) setError(null);
          }}
          editable={!isLoading}
        />
      </View>

      {/* Categorize Button */}
      <TouchableOpacity
        style={[
          styles.button,
          isButtonDisabled && styles.buttonDisabled,
        ]}
        onPress={handleCategorize}
        disabled={isButtonDisabled}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.buttonText}>Categorizing...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>🏷 Categorize Expense</Text>
        )}
      </TouchableOpacity>

      {/* Result Display */}
      {result && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Classification Result</Text>
            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Category</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{result.category}</Text>
              </View>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Confidence</Text>
              {(() => {
                const colors = getConfidenceBadgeColor(result.confidence);
                return (
                  <View
                    style={[
                      styles.confidenceBadge,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.confidenceBadgeText, { color: colors.text }]}>
                      {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>
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
  fieldContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  optional: {
    fontSize: 12,
    fontWeight: "400",
    color: "#94a3b8",
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
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resultContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  resultGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultItem: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  categoryBadgeText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 15,
  },
  confidenceBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  confidenceBadgeText: {
    fontWeight: "700",
    fontSize: 14,
  },
});
