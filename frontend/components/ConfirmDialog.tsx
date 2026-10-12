import React from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Colors, Elevation, Shapes, Typography } from "../constants/theme";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const renderButton = (
    label: string,
    onPress: () => void,
    isPrimary: boolean,
    destructive: boolean
  ) => {
    const textColor = destructive
      ? Colors.error
      : isPrimary
      ? Colors.primary
      : Colors.secondaryText;

    const content = (
      <View style={styles.buttonInner}>
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      </View>
    );

    if (Platform.OS === "android") {
      return (
        <View style={styles.buttonWrapper}>
          <TouchableNativeFeedback
            onPress={onPress}
            background={TouchableNativeFeedback.Ripple(Colors.rippleNeutral, false)}
          >
            {content}
          </TouchableNativeFeedback>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.buttonWrapper}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.actionsRow}>
                {renderButton(cancelLabel, onCancel, false, false)}
                {renderButton(confirmLabel, onConfirm, true, isDestructive)}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusLg,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    ...Elevation.level3,
  },
  title: {
    ...Typography.titleLarge,
    fontSize: 18,
    color: Colors.primaryText,
    marginBottom: 8,
  },
  message: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  buttonWrapper: {
    borderRadius: Shapes.radiusSm,
    overflow: "hidden",
  },
  buttonInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...Typography.labelLarge,
    fontWeight: "700",
  },
});
