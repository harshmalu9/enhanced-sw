import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableNativeFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Typography } from "../constants/theme";

interface ActionItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ActionItem[];
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  title,
  subtitle,
  onBack,
  actions = [],
}) => {
  const renderIconButton = (action: ActionItem, key: number | string) => {
    const content = (
      <View style={styles.iconButtonInner}>
        <MaterialIcons name={action.icon} size={24} color={Colors.primaryText} />
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View key={key} style={styles.iconButtonWrapper}>
          <TouchableNativeFeedback
            onPress={action.onPress}
            background={TouchableNativeFeedback.Ripple(Colors.rippleNeutral, true, 24)}
            accessibilityLabel={action.accessibilityLabel}
          >
            {content}
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={key}
        onPress={action.onPress}
        style={styles.iconButtonWrapper}
        accessibilityLabel={action.accessibilityLabel}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {onBack ? (
          renderIconButton(
            {
              icon: "arrow-back",
              onPress: onBack,
              accessibilityLabel: "Back",
            },
            "back"
          )
        ) : (
          <View style={styles.brandIconContainer}>
            <View style={styles.brandBadge}>
              <MaterialIcons name="account-balance-wallet" size={20} color={Colors.onPrimary} />
            </View>
          </View>
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsSection}>
        {actions.map((act, idx) => renderIconButton(act, idx))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 58,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  brandIconContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    ...Typography.headlineMedium,
    fontSize: 18,
    color: Colors.primaryText,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 1,
  },
  actionsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButtonWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonInner: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
