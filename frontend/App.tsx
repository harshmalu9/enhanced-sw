import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
  const [isEqualSplit, setIsEqualSplit] = useState<boolean>(false);
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

    const finalInstruction = isEqualSplit
      ? "Everyone shared all items equally."
      : instruction.trim();

    if (!isEqualSplit && !finalInstruction) {
      setError("Please enter who consumed which items in the instruction box.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await processBill({
        receipt,
        people,
        instruction: finalInstruction,
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
    setIsEqualSplit(false);
    setInstruction("");
    setSplitResult(null);
    setValidation(null);
    setError(null);
  };

  const isCalculateDisabled =
    people.length < 2 || (!isEqualSplit && !instruction.trim()) || isLoading;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <Header />

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
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
                    Add participants and choose how to split the bill.
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

                  {/* Participants Section */}
                  <ParticipantInput
                    people={people}
                    onAddPerson={handleAddPerson}
                    onRemovePerson={handleRemovePerson}
                    disabled={isLoading}
                  />

                  {/* Equal Split Toggle Option */}
                  <View style={styles.equalSplitCard}>
                    <View style={styles.equalSplitLeft}>
                      <Text style={styles.equalSplitTitle}>⚖ Split Bill Equally</Text>
                      <Text style={styles.equalSplitSubtitle}>
                        Divide the total bill evenly among all {people.length > 0 ? people.length : ""}{" "}
                        participants
                      </Text>
                    </View>
                    <Switch
                      value={isEqualSplit}
                      onValueChange={setIsEqualSplit}
                      trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
                      thumbColor={isEqualSplit ? "#2563eb" : "#f1f5f9"}
                      disabled={isLoading}
                    />
                  </View>

                  {/* Conditional: Either show Equal Split Banner or Natural Language Input */}
                  {isEqualSplit ? (
                    <View style={styles.equalSplitNotice}>
                      <Text style={styles.equalSplitNoticeText}>
                        ✓ Equal split enabled: Every participant will pay an exact equal share
                        of the bill and tax. No AI prompt required.
                      </Text>
                    </View>
                  ) : (
                    <InstructionInput
                      instruction={instruction}
                      onChangeInstruction={setInstruction}
                      disabled={isLoading}
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.calculateButton,
                      isCalculateDisabled && styles.buttonDisabled,
                    ]}
                    onPress={handleCalculateSplit}
                    disabled={isCalculateDisabled}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.calculateButtonText}>
                      {isEqualSplit ? "⚡ Calculate Equal Split" : "⚡ Calculate Split"}
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
    paddingBottom: 140,
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
  equalSplitCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
  },
  equalSplitLeft: {
    flex: 1,
    marginRight: 12,
  },
  equalSplitTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  equalSplitSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  equalSplitNotice: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
  equalSplitNoticeText: {
    fontSize: 13,
    color: "#1e40af",
    lineHeight: 18,
    fontWeight: "500",
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
