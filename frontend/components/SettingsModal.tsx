import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Shapes, Typography } from "../constants/theme";
import { seedDemoData } from "../services/api";
import { MaterialBottomSheet } from "./MaterialBottomSheet";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onDataReset,
}) => {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await seedDemoData();
      onDataReset();
      onClose();
      Alert.alert(
        "Data Populated",
        `Loaded ${res.expensesCount} realistic transactions and monthly budget.`
      );
    } catch (err: unknown) {
      Alert.alert(
        "Seed Error",
        err instanceof Error ? err.message : "Failed to load seed data."
      );
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <MaterialBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Settings & Data</Text>
        <Text style={styles.subtitle}>
          Manage your local data or populate sample transactions.
        </Text>
      </View>

      <View style={styles.optionRow}>
        <View style={styles.optionIconContainer}>
          <MaterialIcons name="restore" size={22} color={Colors.primary} />
        </View>
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionTitle}>Load Sample Data</Text>
          <Text style={styles.optionDescription}>
            Populates 45 realistic expenses (groceries, dining, transit) and monthly budget.
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {Platform.OS === "android" ? (
          <View style={styles.primaryButtonWrapper}>
            <TouchableNativeFeedback
              onPress={handleSeed}
              disabled={isSeeding}
              background={TouchableNativeFeedback.Ripple(Colors.rippleLight, false)}
            >
              <View style={styles.primaryButtonInner}>
                {isSeeding ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Populate Sample Data</Text>
                )}
              </View>
            </TouchableNativeFeedback>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryButtonWrapper}
            onPress={handleSeed}
            disabled={isSeeding}
            activeOpacity={0.8}
          >
            <View style={styles.primaryButtonInner}>
              {isSeeding ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Populate Sample Data</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </MaterialBottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: 14,
  },
  title: {
    ...Typography.titleLarge,
    fontSize: 18,
    color: Colors.primaryText,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusMd,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    marginBottom: 2,
  },
  optionDescription: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    lineHeight: 16,
  },
  actionsContainer: {
    alignItems: "stretch",
  },
  primaryButtonWrapper: {
    backgroundColor: Colors.primary,
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
  },
  primaryButtonInner: {
    paddingVertical: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
});
