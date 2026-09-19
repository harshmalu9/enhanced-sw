import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { Header } from "./components/Header";
import { ReceiptUploader } from "./components/ReceiptUploader";
import { ParticipantInput } from "./components/ParticipantInput";
import { InstructionInput } from "./components/InstructionInput";
import { SplitResultView } from "./components/SplitResultView";
import { ErrorBanner } from "./components/ErrorBanner";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { processBill, ApiError } from "./services/api";
import {
  BillSplitResult,
  BillValidationResult,
  ReceiptFile,
} from "./types/bill";

type Stage = "upload" | "details" | "result";

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const [stage, setStage] = useState<Stage>("upload");
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [instruction, setInstruction] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitResult, setSplitResult] = useState<BillSplitResult | null>(null);
  const [validation, setValidation] = useState<BillValidationResult | null>(null);

  const handleSelectReceipt = (selectedReceipt: ReceiptFile) => {
    setReceipt(selectedReceipt);
    setError(null);
  };

  const handleContinueToDetails = () => {
    if (!receipt) {
      setError("Please select a receipt image first.");
      return;
    }
    setError(null);
    setStage("details");
  };

  const handleAddPerson = (name: string) => {
    if (!name.trim()) return;
    setPeople((prev) => [...prev, name.trim()]);
  };

  const handleRemovePerson = (index: number) => {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCalculateSplit = async () => {
    if (!receipt) {
      setError("Receipt image is missing. Please select a receipt.");
      setStage("upload");
      return;
    }

    if (people.length < 2) {
      setError("At least two participants are required to split a bill.");
      return;
    }

    if (!instruction.trim()) {
      setError("Please enter who consumed which items in the instruction box.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await processBill({
        receipt,
        people,
        instruction: instruction.trim(),
      });

      setSplitResult(response.data);
      setValidation(response.validation || null);
      setStage("result");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred while processing the bill.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStage("upload");
    setReceipt(null);
    setPeople([]);
    setInstruction("");
    setSplitResult(null);
    setValidation(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Header />

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner
            message={error}
            onDismiss={() => setError(null)}
            onRetry={stage === "details" ? handleCalculateSplit : undefined}
          />

          {isLoading ? (
            <LoadingOverlay />
          ) : (
            <>
              {/* STAGE 1: Receipt Selection */}
              {stage === "upload" && (
                <ReceiptUploader
                  receipt={receipt}
                  onSelectReceipt={handleSelectReceipt}
                  onContinue={handleContinueToDetails}
                  isLoading={isLoading}
                />
              )}

              {/* STAGE 2: People & Instructions */}
              {stage === "details" && (
                <View style={styles.stageDetailsCard}>
                  <View style={styles.stageHeaderRow}>
                    <TouchableOpacity
                      onPress={() => setStage("upload")}
                      style={styles.backLink}
                    >
                      <Text style={styles.backLinkText}>← Change Receipt</Text>
                    </TouchableOpacity>
                    <Text style={styles.stageIndicator}>Stage 2 of 2</Text>
                  </View>

                  <Text style={styles.formTitle}>Bill Split Details</Text>
                  <Text style={styles.formSubtitle}>
                    Add participants and explain consumption in natural language.
                  </Text>

                  {/* Selected Receipt Summary pill */}
                  {receipt && (
                    <View style={styles.receiptPill}>
                      <Text style={styles.receiptPillLabel}>Receipt:</Text>
                      <Text style={styles.receiptPillName} numberOfLines={1}>
                        {receipt.name}
                      </Text>
                    </View>
                  )}

                  <ParticipantInput
                    people={people}
                    onAddPerson={handleAddPerson}
                    onRemovePerson={handleRemovePerson}
                    disabled={isLoading}
                  />

                  <InstructionInput
                    instruction={instruction}
                    onChangeInstruction={setInstruction}
                    disabled={isLoading}
                  />

                  <TouchableOpacity
                    style={[
                      styles.calculateButton,
                      (people.length < 2 || !instruction.trim() || isLoading) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={handleCalculateSplit}
                    disabled={people.length < 2 || !instruction.trim() || isLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.calculateButtonText}>
                      ⚡ Calculate Split
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 3: Final Split Result */}
              {stage === "result" && splitResult && (
                <SplitResultView
                  splitResult={splitResult}
                  validation={validation}
                  onReset={handleReset}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  stageDetailsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backLink: {
    paddingVertical: 4,
  },
  backLinkText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  stageIndicator: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 12,
  },
  receiptPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  receiptPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginRight: 4,
  },
  receiptPillName: {
    fontSize: 12,
    color: "#0f172a",
    flex: 1,
  },
  calculateButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  calculateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
