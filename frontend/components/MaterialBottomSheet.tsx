import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Elevation, Shapes } from "../constants/theme";

interface MaterialBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPercent?: number; // e.g. 0.85
}

export const MaterialBottomSheet: React.FC<MaterialBottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeightPercent = 0.88,
}) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const [isRendered, setIsRendered] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
    }
  }, [visible, animValue]);

  if (!isRendered && !visible) return null;

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  const closeButtonOpacity = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const closeButtonScale = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 0.7, 1],
  });

  return (
    <Modal
      transparent
      visible={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.outerContainer}>
        {/* Animated Backdrop (fades smoothly in sync with sheet) */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Animated Content Wrapper */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Prominent Cross Button just above the modal in the center of the screen */}
            <Animated.View
              style={[
                styles.floatingCloseWrapper,
                {
                  opacity: closeButtonOpacity,
                  transform: [{ scale: closeButtonScale }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={onClose}
                style={styles.floatingCloseButton}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Close modal"
              >
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>

            {/* Modal Body Card */}
            <View style={styles.sheetContent}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0F172A",
  },
  keyboardContainer: {
    width: "100%",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    width: "100%",
    alignItems: "center",
  },
  floatingCloseWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    zIndex: 10,
  },
  floatingCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    ...Elevation.level3,
  },
  sheetContent: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Shapes.radiusXl,
    borderTopRightRadius: Shapes.radiusXl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    ...Elevation.level3,
  },
});
