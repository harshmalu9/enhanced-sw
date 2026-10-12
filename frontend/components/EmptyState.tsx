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

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}) => {
  const renderActionButton = () => {
    if (!actionLabel || !onAction) return null;

    const content = (
      <View style={styles.buttonInner}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View style={styles.buttonWrapper}>
          <TouchableNativeFeedback
            onPress={onAction}
            background={TouchableNativeFeedback.Ripple(Colors.rippleLight, false)}
          >
            {content}
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.buttonWrapper}
        onPress={onAction}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialIcons name={icon} size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {renderActionButton()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    ...Typography.titleMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primaryText,
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 20,
  },
  buttonWrapper: {
    backgroundColor: Colors.primary,
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
  },
  buttonInner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
});
