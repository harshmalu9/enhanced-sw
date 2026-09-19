import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ParticipantInputProps {
  people: string[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (index: number) => void;
  disabled?: boolean;
}

export const ParticipantInput: React.FC<ParticipantInputProps> = ({
  people,
  onAddPerson,
  onRemovePerson,
  disabled = false,
}) => {
  const [inputName, setInputName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = inputName.trim();
    if (!trimmed) {
      setError("Participant name cannot be empty.");
      return;
    }
    if (people.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already added.`);
      return;
    }
    setError(null);
    onAddPerson(trimmed);
    setInputName("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Participants</Text>
        <Text style={styles.counterText}>
          {people.length} {people.length === 1 ? "person" : "people"} (min. 2 required)
        </Text>
      </View>

      {/* Participant Chips */}
      <View style={styles.chipsContainer}>
        {people.map((person, index) => (
          <View key={`${person}-${index}`} style={styles.chip}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {person.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.chipText}>{person}</Text>
            {!disabled && (
              <TouchableOpacity
                onPress={() => onRemovePerson(index)}
                style={styles.removeChipButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeChipText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Add Person Input Row */}
      {!disabled && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter name (e.g. Alice, Bob)"
            placeholderTextColor="#94a3b8"
            value={inputName}
            onChangeText={(text) => {
              setInputName(text);
              if (error) setError(null);
            }}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[styles.addButton, !inputName.trim() && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!inputName.trim()}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
      {people.length < 2 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Please add at least {2 - people.length} more participant
            {people.length === 0 ? "s" : ""}.
          </Text>
          {people.length === 0 && !disabled && (
            <TouchableOpacity
              style={styles.demoAddButton}
              onPress={() => ["A", "B", "C"].forEach((p) => onAddPerson(p))}
            >
              <Text style={styles.demoAddText}>⚡ Add Demo Participants (A, B, C)</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  counterText: {
    fontSize: 12,
    color: "#64748b",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  avatarLetter: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  removeChipButton: {
    marginLeft: 6,
    padding: 2,
  },
  removeChipText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  addButton: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 4,
  },
  hintContainer: {
    marginTop: 6,
  },
  hintText: {
    color: "#ea580c",
    fontSize: 12,
  },
  demoAddButton: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  demoAddText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
});
