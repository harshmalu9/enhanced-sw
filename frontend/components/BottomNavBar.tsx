import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Shapes, Typography } from "../constants/theme";

export type NavTab = "home" | "expenses" | "split" | "insights";

interface NavItemConfig {
  key: NavTab;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "expenses", label: "Expenses", icon: "receipt-long" },
  { key: "split", label: "Split", icon: "call-split" },
  { key: "insights", label: "Insights", icon: "insights" },
];

interface BottomNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const renderItem = (item: NavItemConfig) => {
    const isActive = activeTab === item.key;

    const content = (
      <View style={styles.tabContent}>
        <View style={[styles.indicatorPill, isActive && styles.indicatorPillActive]}>
          <MaterialIcons
            name={item.icon}
            size={22}
            color={isActive ? Colors.primary : Colors.secondaryText}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
        >
          {item.label}
        </Text>
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View key={item.key} style={styles.tabWrapper}>
          <TouchableNativeFeedback
            onPress={() => onTabChange(item.key)}
            background={TouchableNativeFeedback.Ripple(Colors.ripple, true, 32)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
          >
            {content}
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={item.key}
        style={styles.tabWrapper}
        onPress={() => onTabChange(item.key)}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={item.label}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.barInner}>{NAV_ITEMS.map(renderItem)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
  },
  barInner: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabWrapper: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  indicatorPill: {
    width: 56,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    backgroundColor: "transparent",
  },
  indicatorPillActive: {
    backgroundColor: Colors.secondary, // Champagne
  },
  tabLabel: {
    ...Typography.labelMedium,
    fontSize: 11,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  tabLabelInactive: {
    color: Colors.secondaryText,
    fontWeight: "500",
  },
});
