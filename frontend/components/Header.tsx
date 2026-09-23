import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onLoadDemoData?: () => void;
  isSeeding?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = "Enhanced Splitwise",
  subtitle = "Intelligent Bill Split",
  onLoadDemoData,
  isSeeding = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI & ML Enhanced</Text>
        </View>

        {onLoadDemoData && (
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={onLoadDemoData}
            disabled={isSeeding}
            activeOpacity={0.7}
          >
            {isSeeding ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text style={styles.demoBtnText}>🚀 Load Demo Data</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 4,
  },
  badge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: "#0369a1",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  demoBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  demoBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 1,
  },
});
