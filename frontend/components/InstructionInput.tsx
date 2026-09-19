import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface InstructionInputProps {
  instruction: string;
  onChangeInstruction: (text: string) => void;
  disabled?: boolean;
}

const SAMPLE_INSTRUCTIONS = [
  "A and B had the Margherita Pizza.\nB and C had the Farmhouse Pizza.\nA, B and C had the Coke.",
  "Everyone shared all items equally.",
];

export const InstructionInput: React.FC<InstructionInputProps> = ({
  instruction,
  onChangeInstruction,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>What did everyone have?</Text>
      <Text style={styles.sublabel}>
        Describe who ate or shared what in plain English:
      </Text>

      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder={
          "Example:\nA and B had the Margherita Pizza.\nB and C had the Farmhouse Pizza.\nEveryone had the Coke."
        }
        placeholderTextColor="#94a3b8"
        value={instruction}
        onChangeText={onChangeInstruction}
        editable={!disabled}
        textAlignVertical="top"
      />

      {/* Quick sample templates for demo convenience */}
      {!disabled && (
        <View style={styles.quickExamplesContainer}>
          <Text style={styles.quickExamplesLabel}>Quick templates for demo:</Text>
          <View style={styles.quickButtonsRow}>
            {SAMPLE_INSTRUCTIONS.map((sample, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.sampleBadge}
                onPress={() => onChangeInstruction(sample)}
              >
                <Text style={styles.sampleBadgeText}>
                  {idx === 0 ? "⚡ Standard Demo Split" : "⚡ Equal Share"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  sublabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    minHeight: 100,
    lineHeight: 20,
  },
  quickExamplesContainer: {
    marginTop: 8,
  },
  quickExamplesLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 4,
  },
  quickButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sampleBadge: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sampleBadgeText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
});
