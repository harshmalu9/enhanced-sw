import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  onRetry,
}) => {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <Text style={styles.icon}>✕</Text>
        <View style={styles.textCol}>
          <Text style={styles.title}>Error</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
      <View style={styles.buttonRow}>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  icon: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "800",
    marginRight: 10,
    marginTop: 2,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: "#b91c1c",
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  dismissButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dismissButtonText: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "600",
  },
});
