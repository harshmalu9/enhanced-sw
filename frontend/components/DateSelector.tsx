import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableNativeFeedback,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Elevation, Shapes, Typography } from "../constants/theme";

interface DateSelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

  // Generate last 30 days list for simple modal picking
  const daysList: { label: string; dateStr: string; subLabel: string }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const isToday = i === 0;
    const isYest = i === 1;
    daysList.push({
      dateStr,
      label: isToday ? "Today" : isYest ? "Yesterday" : label,
      subLabel: `${weekday}, ${label}`,
    });
  }

  const renderChip = (label: string, dateStr: string) => {
    const isSelected = selectedDate === dateStr;

    return (
      <TouchableOpacity
        key={dateStr}
        style={[styles.quickChip, isSelected && styles.quickChipSelected]}
        onPress={() => onSelectDate(dateStr)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.quickChipText,
            isSelected && styles.quickChipTextSelected,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const formatDisplayDate = (dateStr: string) => {
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    try {
      const parts = dateStr.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        {renderChip("Today", todayStr)}
        {renderChip("Yesterday", yesterdayStr)}
        {renderChip("2 days ago", twoDaysAgoStr)}

        <TouchableOpacity
          style={[
            styles.customDateButton,
            selectedDate !== todayStr &&
              selectedDate !== yesterdayStr &&
              selectedDate !== twoDaysAgoStr &&
              styles.quickChipSelected,
          ]}
          onPress={() => setIsPickerVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="calendar-today"
            size={16}
            color={
              selectedDate !== todayStr &&
              selectedDate !== yesterdayStr &&
              selectedDate !== twoDaysAgoStr
                ? Colors.primary
                : Colors.secondaryText
            }
          />
          <Text
            style={[
              styles.customDateText,
              selectedDate !== todayStr &&
                selectedDate !== yesterdayStr &&
                selectedDate !== twoDaysAgoStr &&
                styles.quickChipTextSelected,
            ]}
          >
            {formatDisplayDate(selectedDate)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={isPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Transaction Date</Text>
                  <TouchableOpacity
                    onPress={() => setIsPickerVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={22} color={Colors.secondaryText} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.daysScroll} showsVerticalScrollIndicator={false}>
                  {daysList.map((item) => {
                    const isSelected = selectedDate === item.dateStr;
                    return (
                      <TouchableOpacity
                        key={item.dateStr}
                        style={[styles.dayRow, isSelected && styles.dayRowSelected]}
                        onPress={() => {
                          onSelectDate(item.dateStr);
                          setIsPickerVisible(false);
                        }}
                      >
                        <View>
                          <Text
                            style={[
                              styles.dayLabel,
                              isSelected && styles.dayLabelSelected,
                            ]}
                          >
                            {item.subLabel}
                          </Text>
                          <Text style={styles.dayDateStr}>{item.dateStr}</Text>
                        </View>
                        {isSelected && (
                          <MaterialIcons name="check" size={20} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
    minHeight: 38,
    justifyContent: "center",
  },
  quickChipSelected: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  quickChipText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontWeight: "600",
  },
  quickChipTextSelected: {
    color: Colors.primary,
    fontWeight: "700",
  },
  customDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
    minHeight: 38,
  },
  customDateText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Shapes.radiusXl,
    borderTopRightRadius: Shapes.radiusXl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: "75%",
    ...Elevation.level3,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    ...Typography.titleLarge,
    fontSize: 18,
    color: Colors.primaryText,
  },
  daysScroll: {
    maxHeight: 340,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Shapes.radiusSm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  dayRowSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  dayLabel: {
    ...Typography.bodyLarge,
    fontWeight: "600",
    color: Colors.primaryText,
  },
  dayLabelSelected: {
    color: Colors.primary,
    fontWeight: "700",
  },
  dayDateStr: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 1,
  },
});
