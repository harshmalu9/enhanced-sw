import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Shapes, Typography } from "../constants/theme";
import { BudgetStatus, UpsertBudgetPayload } from "../types/budget";
import { setBudget, ApiError } from "../services/api";
import { MaterialBottomSheet } from "./MaterialBottomSheet";

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

interface BudgetModalProps {
  visible: boolean;
  currentBudget: BudgetStatus | null;
  onClose: () => void;
  onBudgetUpdated: (newStatus: BudgetStatus) => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  visible,
  currentBudget,
  onClose,
  onBudgetUpdated,
}) => {
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (currentBudget) {
        setMonthlyBudgetInput(String(currentBudget.monthlyBudget));
        const catMap: Record<string, string> = {};
        currentBudget.categoryStatuses.forEach((c) => {
          catMap[c.category] = String(c.budgetLimit);
        });
        setCategoryInputs(catMap);
      } else {
        setMonthlyBudgetInput("35000");
        setCategoryInputs({
          "Food & Dining": "6000",
          Groceries: "5000",
          Transportation: "3000",
          Shopping: "5000",
          "Bills & Utilities": "4500",
        });
      }
      setError(null);
    }
  }, [visible, currentBudget]);

  const handleSave = async () => {
    const monthlyAmt = parseFloat(monthlyBudgetInput.trim());
    if (isNaN(monthlyAmt) || monthlyAmt <= 0) {
      setError("Please enter a valid monthly budget amount.");
      return;
    }

    const catBudgets: Record<string, number> = {};
    for (const [cat, val] of Object.entries(categoryInputs)) {
      const parsed = parseFloat(val.trim());
      if (!isNaN(parsed) && parsed > 0) {
        catBudgets[cat] = parsed;
      }
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    setIsSaving(true);
    setError(null);

    try {
      const payload: UpsertBudgetPayload = {
        monthYear: currentMonth,
        monthlyBudget: monthlyAmt,
        categoryBudgets: catBudgets,
      };

      const newStatus = await setBudget(payload);
      onBudgetUpdated(newStatus);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update monthly budget.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderActionButton = (
    label: string,
    onPress: () => void,
    isPrimary: boolean,
    loading = false
  ) => {
    const content = (
      <View
        style={[
          styles.actionButtonInner,
          isPrimary ? styles.primaryButtonInner : styles.secondaryButtonInner,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.onPrimary} />
        ) : (
          <Text
            style={[
              styles.actionButtonText,
              isPrimary ? styles.primaryButtonText : styles.secondaryButtonText,
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View
          style={[
            styles.actionButtonWrapper,
            isPrimary ? styles.primaryButtonWrapper : styles.secondaryButtonWrapper,
          ]}
        >
          <TouchableNativeFeedback
            onPress={onPress}
            disabled={loading}
            background={TouchableNativeFeedback.Ripple(
              isPrimary ? Colors.rippleLight : Colors.rippleNeutral,
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
        style={[
          styles.actionButtonWrapper,
          isPrimary ? styles.primaryButtonWrapper : styles.secondaryButtonWrapper,
        ]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <MaterialBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>
          {currentBudget ? "Edit Monthly Budget" : "Set Monthly Budget"}
        </Text>
        <Text style={styles.sheetSubtitle}>
          Set total and category-level spending limits
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Total Monthly Budget (₹)</Text>
          <TextInput
            style={styles.mainInput}
            keyboardType="numeric"
            placeholder="e.g. 35000"
            placeholderTextColor={Colors.tertiaryText}
            value={monthlyBudgetInput}
            onChangeText={(val) => {
              setMonthlyBudgetInput(val);
              if (error) setError(null);
            }}
          />
        </View>

        <View style={styles.categoryHeaderRow}>
          <Text style={styles.sectionHeader}>Category Spending Limits</Text>
          <Text style={styles.optionalNote}>(Optional)</Text>
        </View>

        {CANONICAL_CATEGORIES.map((cat) => (
          <View key={cat} style={styles.categoryRow}>
            <Text style={styles.categoryName}>{cat}</Text>
            <View style={styles.categoryInputWrapper}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.categoryInput}
                keyboardType="numeric"
                placeholder="No cap"
                placeholderTextColor={Colors.tertiaryText}
                value={categoryInputs[cat] || ""}
                onChangeText={(val) =>
                  setCategoryInputs((prev) => ({ ...prev, [cat]: val }))
                }
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footerActions}>
        {renderActionButton("Cancel", onClose, false)}
        {renderActionButton("Save Budget", handleSave, true, isSaving)}
      </View>
    </MaterialBottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: 14,
  },
  sheetTitle: {
    ...Typography.titleLarge,
    fontSize: 18,
    color: Colors.primaryText,
  },
  sheetSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.errorContainer,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: "500",
    flex: 1,
  },
  scrollArea: {
    maxHeight: 360,
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    ...Typography.labelLarge,
    color: Colors.primaryText,
    marginBottom: 6,
  },
  mainInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusMd,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primaryText,
    backgroundColor: Colors.surfaceVariant,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
  },
  sectionHeader: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
  },
  optionalNote: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  categoryName: {
    ...Typography.bodyMedium,
    color: Colors.primaryText,
    flex: 1,
    marginRight: 8,
  },
  categoryInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 8,
    width: 120,
    height: 38,
  },
  currencyPrefix: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
    fontWeight: "600",
    marginRight: 4,
  },
  categoryInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.primaryText,
    textAlign: "right",
    paddingVertical: 0,
  },
  footerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
  },
  actionButtonWrapper: {
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
  },
  primaryButtonWrapper: {
    backgroundColor: Colors.primary,
  },
  secondaryButtonWrapper: {
    backgroundColor: Colors.surfaceVariant,
  },
  actionButtonInner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonInner: {},
  secondaryButtonInner: {},
  actionButtonText: {
    ...Typography.labelLarge,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: Colors.onPrimary,
  },
  secondaryButtonText: {
    color: Colors.primaryText,
  },
});
