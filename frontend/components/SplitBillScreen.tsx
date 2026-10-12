import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Elevation, Shapes, Typography } from "../constants/theme";
import { processBill, simplifyDebts, createExpense, ApiError } from "../services/api";
import { BillSplitResult, BillValidationResult, ReceiptFile } from "../types/bill";
import { GroupSettlementRequest, GroupSettlementResponse, ParticipantPayment } from "../types/settlement";

interface SplitBillScreenProps {
  onDataMutated: () => void;
  onNavigateToExpenses: () => void;
}

type SplitViewMode = "receipt" | "group";
type ReceiptStep = "upload" | "people" | "review";

export const SplitBillScreen: React.FC<SplitBillScreenProps> = ({
  onDataMutated,
  onNavigateToExpenses,
}) => {
  const [viewMode, setViewMode] = useState<SplitViewMode>("receipt");

  // Receipt Split State
  const [step, setStep] = useState<ReceiptStep>("upload");
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [people, setPeople] = useState<string[]>(["Me", "Friend"]);
  const [myParticipantIndex, setMyParticipantIndex] = useState<number>(0);
  const [newPersonName, setNewPersonName] = useState<string>("");
  const [isEqualSplit, setIsEqualSplit] = useState<boolean>(true);
  const [instruction, setInstruction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [splitResult, setSplitResult] = useState<BillSplitResult | null>(null);
  const [validation, setValidation] = useState<BillValidationResult | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isSavingShare, setIsSavingShare] = useState<boolean>(false);
  const [isShareSaved, setIsShareSaved] = useState<boolean>(false);

  // Group Balances State
  const [groupTitle, setGroupTitle] = useState<string>("Trip Expenses");
  const [groupPayments, setGroupPayments] = useState<ParticipantPayment[]>([
    { person: "Arun", amount_paid: 1200 },
    { person: "Sneha", amount_paid: 400 },
    { person: "Vikram", amount_paid: 200 },
  ]);
  const [newMemberName, setNewMemberName] = useState<string>("");
  const [newMemberAmount, setNewMemberAmount] = useState<string>("");
  const [settlementResult, setSettlementResult] = useState<GroupSettlementResponse | null>(null);
  const [isSettlementCalculating, setIsSettlementCalculating] = useState<boolean>(false);
  const [settledTransferIndices, setSettledTransferIndices] = useState<Record<number, boolean>>({});

  // Android Back Handler Support for Stepper
  useEffect(() => {
    const onBackPress = () => {
      if (viewMode === "receipt") {
        if (step === "review") {
          setStep("people");
          return true;
        }
        if (step === "people") {
          setStep("upload");
          return true;
        }
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [viewMode, step]);

  // Image Picking
  const handlePickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert("Permission Required", "Camera access is needed to take a receipt photo.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.85,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setReceipt({
            uri: asset.uri,
            name: asset.fileName || "camera_receipt.jpg",
            type: asset.mimeType || "image/jpeg",
            file: (asset as any).file,
          });
          setReceiptError(null);
        }
      } else {
        const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPerm.granted) {
          Alert.alert("Permission Required", "Gallery access is needed to select a receipt.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setReceipt({
            uri: asset.uri,
            name: asset.fileName || "receipt.jpg",
            type: asset.mimeType || "image/jpeg",
            file: (asset as any).file,
          });
          setReceiptError(null);
        }
      }
    } catch {
      Alert.alert("Error", "Could not open image picker.");
    }
  };

  const handleAddParticipant = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    if (people.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setReceiptError(`"${trimmed}" is already added.`);
      return;
    }
    setPeople((prev) => [...prev, trimmed]);
    setNewPersonName("");
    setReceiptError(null);
  };

  const handleRemoveParticipant = (index: number) => {
    if (people.length <= 2) {
      setReceiptError("At least two participants are required to split a bill.");
      return;
    }
    setPeople((prev) => prev.filter((_, i) => i !== index));
    if (myParticipantIndex >= index && myParticipantIndex > 0) {
      setMyParticipantIndex((prev) => prev - 1);
    }
  };

  const handleProcessSplit = async () => {
    if (!receipt) {
      setReceiptError("Please select or take a photo of a receipt.");
      setStep("upload");
      return;
    }

    if (people.length < 2) {
      setReceiptError("Please add at least 2 participants.");
      return;
    }

    const finalInstruction = isEqualSplit
      ? "Everyone shared all items equally."
      : instruction.trim();

    if (!isEqualSplit && !finalInstruction) {
      setReceiptError("Please describe who had which items.");
      return;
    }

    setReceiptError(null);
    setIsProcessing(true);
    setProcessingStatus("Scanning receipt items...");

    try {
      setTimeout(() => setProcessingStatus("Calculating fair shares..."), 1500);

      const res = await processBill({
        receipt,
        people,
        instruction: finalInstruction,
      });

      setSplitResult(res.data);
      setValidation(res.validation || null);
      setIsShareSaved(false);
      setStep("review");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setReceiptError(err.message);
      } else if (err instanceof Error) {
        setReceiptError(err.message);
      } else {
        setReceiptError("Failed to process bill. Please check the image and try again.");
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  const handleSaveMyShare = async () => {
    if (!splitResult) return;

    const myName = people[myParticipantIndex] || people[0];
    const myShare = splitResult.shares.find((s) => s.person === myName);
    if (!myShare || myShare.total <= 0) {
      Alert.alert("Error", "Could not find a valid share amount to save.");
      return;
    }

    setIsSavingShare(true);
    try {
      const merchantName = splitResult.bill.merchant || "Split Bill";
      await createExpense({
        description: `My share: ${merchantName}`,
        amount: myShare.total,
        merchant: merchantName,
        date: new Date().toISOString().split("T")[0],
      });

      setIsShareSaved(true);
      onDataMutated();
      Alert.alert(
        "Share Recorded",
        `Your ₹${myShare.total.toFixed(2)} share has been added to Expenses.`,
        [
          { text: "View Expenses", onPress: onNavigateToExpenses },
          { text: "Done", style: "cancel" },
        ]
      );
    } catch (err: unknown) {
      Alert.alert(
        "Save Failed",
        err instanceof Error ? err.message : "Failed to record share to expenses."
      );
    } finally {
      setIsSavingShare(false);
    }
  };

  // Group Balances Handlers
  const handleAddGroupMember = () => {
    if (!newMemberName.trim()) {
      Alert.alert("Invalid Name", "Please enter a member name.");
      return;
    }
    const amt = parseFloat(newMemberAmount || "0");
    if (isNaN(amt) || amt < 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount paid.");
      return;
    }
    setGroupPayments((prev) => [...prev, { person: newMemberName.trim(), amount_paid: amt }]);
    setNewMemberName("");
    setNewMemberAmount("");
  };

  const handleCalculateSettlement = async () => {
    if (groupPayments.length < 2) {
      Alert.alert("Participants Needed", "Add at least 2 participants to calculate balances.");
      return;
    }

    setIsSettlementCalculating(true);
    try {
      const res = await simplifyDebts({
        title: groupTitle.trim() || "Group Settlement",
        payments: groupPayments,
      });
      setSettlementResult(res);
      setSettledTransferIndices({});
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to calculate balances.");
    } finally {
      setIsSettlementCalculating(false);
    }
  };

  const handleToggleSettled = (idx: number) => {
    setSettledTransferIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Settlement Tracking Metrics
  const transfersList = settlementResult?.transfers || [];
  const settledTransfersCount = transfersList.filter((_, idx) => !!settledTransferIndices[idx]).length;
  const pendingTransfersCount = transfersList.length - settledTransfersCount;
  const unsettledTransfersList = transfersList.filter((_, idx) => !settledTransferIndices[idx]);
  const unsettledAmountRemaining = unsettledTransfersList.reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amt: number) => {
    return `₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      {/* Top Segmented Control */}
      <View style={styles.segmentedBar}>
        <TouchableOpacity
          style={[styles.segmentButton, viewMode === "receipt" && styles.segmentButtonActive]}
          onPress={() => setViewMode("receipt")}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="receipt-long"
            size={18}
            color={viewMode === "receipt" ? Colors.primary : Colors.secondaryText}
          />
          <Text
            style={[
              styles.segmentText,
              viewMode === "receipt" && styles.segmentTextActive,
            ]}
          >
            Receipt Split
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentButton, viewMode === "group" && styles.segmentButtonActive]}
          onPress={() => setViewMode("group")}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={18}
            color={viewMode === "group" ? Colors.primary : Colors.secondaryText}
          />
          <Text
            style={[
              styles.segmentText,
              viewMode === "group" && styles.segmentTextActive,
            ]}
          >
            Group Balances
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW MODE 1: Receipt Split Workflow */}
      {viewMode === "receipt" && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {receiptError && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color={Colors.error} />
              <Text style={styles.errorBoxText}>{receiptError}</Text>
            </View>
          )}

          {isProcessing ? (
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingTitle}>{processingStatus}</Text>
              <Text style={styles.processingSubtitle}>
                Analyzing items, taxes, and assigning shares
              </Text>
            </View>
          ) : (
            <>
              {/* STEP 1: Receipt Upload */}
              {step === "upload" && (
                <View style={styles.card}>
                  <Text style={styles.stepTitle}>Step 1: Select Receipt</Text>
                  <Text style={styles.stepSubtitle}>
                    Take a photo or select an existing receipt image
                  </Text>

                  {receipt ? (
                    <View style={styles.receiptPreviewContainer}>
                      <Image
                        source={{ uri: receipt.uri }}
                        style={styles.receiptImage}
                        resizeMode="contain"
                      />
                      <View style={styles.receiptFileInfoRow}>
                        <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                        <Text style={styles.receiptFileName} numberOfLines={1}>
                          {receipt.name}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.uploadPromptBox}>
                      <MaterialIcons name="receipt-long" size={44} color={Colors.secondaryText} />
                      <Text style={styles.uploadPromptTitle}>No receipt selected</Text>
                    </View>
                  )}

                  <View style={styles.imageActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.imagePickerButton}
                      onPress={() => handlePickImage(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="photo-camera" size={20} color={Colors.primary} />
                      <Text style={styles.imagePickerButtonText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.imagePickerButton}
                      onPress={() => handlePickImage(false)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="photo-library" size={20} color={Colors.primary} />
                      <Text style={styles.imagePickerButtonText}>Choose from Gallery</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryActionButton,
                      !receipt && styles.primaryActionDisabled,
                    ]}
                    onPress={() => {
                      if (!receipt) {
                        setReceiptError("Please select a receipt first.");
                        return;
                      }
                      setReceiptError(null);
                      setStep("people");
                    }}
                    disabled={!receipt}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionButtonText}>Continue to Participants</Text>
                    <MaterialIcons name="arrow-forward" size={18} color={Colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 2: People & Instructions */}
              {step === "people" && (
                <View style={styles.card}>
                  <View style={styles.stepperNavRow}>
                    <TouchableOpacity
                      onPress={() => setStep("upload")}
                      style={styles.backStepButton}
                    >
                      <MaterialIcons name="arrow-back" size={18} color={Colors.primary} />
                      <Text style={styles.backStepText}>Change Receipt</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepIndicator}>Step 2 of 2</Text>
                  </View>

                  <Text style={styles.stepTitle}>Participants & Split Mode</Text>
                  <Text style={styles.stepSubtitle}>
                    Add everyone sharing the bill and choose how to split
                  </Text>

                  {/* Add Person Input */}
                  <View style={styles.addPersonRow}>
                    <TextInput
                      style={styles.addPersonInput}
                      placeholder="Enter name (e.g. Rahul, Meera)"
                      placeholderTextColor={Colors.tertiaryText}
                      value={newPersonName}
                      onChangeText={setNewPersonName}
                      onSubmitEditing={handleAddParticipant}
                    />
                    <TouchableOpacity
                      style={styles.addPersonButton}
                      onPress={handleAddParticipant}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addPersonButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Participants Chips */}
                  <View style={styles.chipsContainer}>
                    {people.map((person, idx) => (
                      <View key={idx} style={styles.personChip}>
                        <Text style={styles.personChipText}>{person}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveParticipant(idx)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="close" size={16} color={Colors.secondaryText} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* "Which person are you?" Selector */}
                  <View style={styles.userSelectSection}>
                    <Text style={styles.userSelectLabel}>Which person is you?</Text>
                    <View style={styles.userSelectChipsRow}>
                      {people.map((person, idx) => {
                        const isMe = myParticipantIndex === idx;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.userChip, isMe && styles.userChipActive]}
                            onPress={() => setMyParticipantIndex(idx)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.userChipText,
                                isMe && styles.userChipTextActive,
                              ]}
                            >
                              {person} {isMe ? "(You)" : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Equal Split Switch */}
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={styles.switchTitle}>Split Bill Equally</Text>
                      <Text style={styles.switchSubtitle}>
                        Divide total bill evenly among {people.length} people
                      </Text>
                    </View>
                    <Switch
                      value={isEqualSplit}
                      onValueChange={setIsEqualSplit}
                      trackColor={{ false: Colors.outline, true: Colors.primaryContainer }}
                      thumbColor={isEqualSplit ? Colors.primary : Colors.surface}
                    />
                  </View>

                  {/* Custom Split Natural Language Textarea */}
                  {!isEqualSplit && (
                    <View style={styles.instructionContainer}>
                      <Text style={styles.instructionLabel}>Item Consumption Details</Text>
                      <TextInput
                        style={styles.instructionInput}
                        multiline
                        numberOfLines={4}
                        placeholder="Describe who had what. Example:&#10;Rahul had the burger and Coke.&#10;Meera and Vikram shared the pizza."
                        placeholderTextColor={Colors.tertiaryText}
                        value={instruction}
                        onChangeText={setInstruction}
                        textAlignVertical="top"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={handleProcessSplit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryActionButtonText}>Calculate Split</Text>
                    <MaterialIcons name="calculate" size={20} color={Colors.onPrimary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: Final Split Result */}
              {step === "review" && splitResult && (
                <View style={styles.card}>
                  <View style={styles.stepperNavRow}>
                    <TouchableOpacity
                      onPress={() => setStep("people")}
                      style={styles.backStepButton}
                    >
                      <MaterialIcons name="arrow-back" size={18} color={Colors.primary} />
                      <Text style={styles.backStepText}>Edit Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setStep("upload");
                        setSplitResult(null);
                        setReceipt(null);
                      }}
                    >
                      <Text style={styles.newSplitText}>New Split</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Merchant & Total Header */}
                  <View style={styles.billSummaryHeader}>
                    <View style={styles.billSummaryLeft}>
                      <Text style={styles.merchantTitle}>
                        {splitResult.bill.merchant || "Receipt Bill"}
                      </Text>
                      <Text style={styles.billMetaText}>
                        Total Bill: {formatCurrency(splitResult.bill.total)}
                      </Text>
                    </View>
                    <View style={styles.reconciledPill}>
                      <MaterialIcons name="check" size={14} color={Colors.success} />
                      <Text style={styles.reconciledText}>Reconciled</Text>
                    </View>
                  </View>

                  {/* Warning if math inconsistent */}
                  {validation && !validation.is_consistent && (
                    <View style={styles.warningBox}>
                      <MaterialIcons name="warning" size={16} color={Colors.warning} />
                      <Text style={styles.warningText}>
                        {validation.message || "Line items differed slightly from receipt total."}
                      </Text>
                    </View>
                  )}

                  {/* Individual Shares List */}
                  <Text style={styles.sharesHeader}>Per-Person Breakdown</Text>
                  <View style={styles.sharesList}>
                    {splitResult.shares.map((share, idx) => {
                      const isMe =
                        share.person.toLowerCase() ===
                        (people[myParticipantIndex] || "").toLowerCase();
                      return (
                        <View
                          key={idx}
                          style={[styles.shareItemRow, isMe && styles.myShareItemRow]}
                        >
                          <View style={styles.sharePersonCol}>
                            <Text
                              style={[
                                styles.sharePersonName,
                                isMe && styles.mySharePersonName,
                              ]}
                            >
                              {share.person} {isMe ? "(You)" : ""}
                            </Text>
                            <Text style={styles.shareItemCount}>
                              {share.items.length} item{share.items.length === 1 ? "" : "s"}
                              {share.tax > 0 ? ` + ${formatCurrency(share.tax)} tax` : ""}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.shareAmount,
                              isMe && styles.myShareAmount,
                            ]}
                          >
                            {formatCurrency(share.total)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Primary Action: Add My Share to Expenses */}
                  <View style={styles.recordShareSection}>
                    <TouchableOpacity
                      style={[
                        styles.recordShareButton,
                        isShareSaved && styles.recordShareButtonSaved,
                      ]}
                      onPress={handleSaveMyShare}
                      disabled={isSavingShare || isShareSaved}
                      activeOpacity={0.8}
                    >
                      {isSavingShare ? (
                        <ActivityIndicator size="small" color={Colors.onPrimary} />
                      ) : (
                        <>
                          <MaterialIcons
                            name={isShareSaved ? "check" : "add-to-photos"}
                            size={20}
                            color={Colors.onPrimary}
                          />
                          <Text style={styles.recordShareButtonText}>
                            {isShareSaved
                              ? "Share Recorded to Expenses"
                              : `Add My Share (${formatCurrency(
                                  splitResult.shares[myParticipantIndex]?.total ||
                                    splitResult.shares[0]?.total ||
                                    0
                                )}) to Expenses`}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* VIEW MODE 2: Group Balances / Debt Simplification */}
      {viewMode === "group" && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.stepTitle}>Group Expense Balances</Text>
            <Text style={styles.stepSubtitle}>
              Calculate minimum settlement transfers among group members
            </Text>

            {/* Event Name */}
            <Text style={styles.inputLabel}>Event / Trip Name</Text>
            <TextInput
              style={styles.textInput}
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="e.g. Weekend Trip"
              placeholderTextColor={Colors.tertiaryText}
            />

            {/* Members & Paid amounts */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              Amounts Paid ({groupPayments.length} members)
            </Text>

            {groupPayments.map((p, idx) => (
              <View key={idx} style={styles.paymentRow}>
                <View style={styles.memberPill}>
                  <Text style={styles.memberName}>{p.person}</Text>
                </View>
                <View style={styles.paymentInputWrapper}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.paymentAmountInput}
                    keyboardType="numeric"
                    value={String(p.amount_paid)}
                    onChangeText={(val) => {
                      const parsed = parseFloat(val);
                      setGroupPayments((prev) => {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], amount_paid: isNaN(parsed) ? 0 : parsed };
                        return copy;
                      });
                    }}
                  />
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setGroupPayments((prev) => prev.filter((_, i) => i !== idx))
                  }
                  style={styles.deleteMemberBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="close" size={18} color={Colors.tertiaryText} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Member Row */}
            <View style={styles.addMemberRow}>
              <TextInput
                style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                placeholder="Member name"
                placeholderTextColor={Colors.tertiaryText}
                value={newMemberName}
                onChangeText={setNewMemberName}
              />
              <TextInput
                style={[styles.textInput, { width: 100, marginRight: 8 }]}
                placeholder="Paid (₹)"
                placeholderTextColor={Colors.tertiaryText}
                keyboardType="numeric"
                value={newMemberAmount}
                onChangeText={setNewMemberAmount}
              />
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={handleAddGroupMember}
                activeOpacity={0.7}
              >
                <Text style={styles.addMemberBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                groupPayments.length < 2 && styles.primaryActionDisabled,
              ]}
              onPress={handleCalculateSettlement}
              disabled={groupPayments.length < 2 || isSettlementCalculating}
              activeOpacity={0.8}
            >
              {isSettlementCalculating ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.primaryActionButtonText}>Calculate Balances</Text>
                  <MaterialIcons name="swap-horiz" size={20} color={Colors.onPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Settlement Results */}
          {settlementResult && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Settlement Plan</Text>

              <View style={styles.settlementMetricsRow}>
                <View style={styles.settlementMetric}>
                  <Text style={styles.settlementMetricLabel}>Total Spent</Text>
                  <Text style={styles.settlementMetricValue}>
                    {formatCurrency(settlementResult.total_group_spent)}
                  </Text>
                </View>
                <View style={styles.settlementMetricDivider} />
                <View style={styles.settlementMetric}>
                  <Text style={styles.settlementMetricLabel}>Fair Share / Person</Text>
                  <Text style={styles.settlementMetricValue}>
                    {formatCurrency(settlementResult.fair_share_per_person || 0)}
                  </Text>
                </View>
              </View>

              {/* Balances */}
              <Text style={styles.sharesHeader}>Net Balances</Text>
              {settlementResult.balances.map((b, i) => {
                const isCreditor = b.net_balance > 0.01;
                const isDebtor = b.net_balance < -0.01;
                return (
                  <View key={i} style={styles.balanceRow}>
                    <View>
                      <Text style={styles.balancePersonName}>{b.person}</Text>
                      <Text style={styles.balanceDetail}>Paid {formatCurrency(b.amount_paid)}</Text>
                    </View>
                    <View
                      style={[
                        styles.balanceBadge,
                        isCreditor
                          ? styles.badgeGreen
                          : isDebtor
                          ? styles.badgeRed
                          : styles.badgeNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          styles.balanceBadgeText,
                          isCreditor
                            ? { color: Colors.success }
                            : isDebtor
                            ? { color: Colors.error }
                            : { color: Colors.secondaryText },
                        ]}
                      >
                        {isCreditor
                          ? `Gets back +${formatCurrency(b.net_balance)}`
                          : isDebtor
                          ? `Owes -${formatCurrency(Math.abs(b.net_balance))}`
                          : "Settled"}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Direct Transfers & Settlement Tracking */}
              <View style={styles.settlementSectionHeaderRow}>
                <Text style={styles.sharesHeader}>
                  Suggested Transfers ({settlementResult.transfers.length})
                </Text>
                {settlementResult.transfers.length > 0 && (
                  <View style={styles.trackingOverviewPills}>
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>
                        {pendingTransfersCount} Pending
                      </Text>
                    </View>
                    <View style={styles.settledPill}>
                      <Text style={styles.settledPillText}>
                        {settledTransfersCount} Settled
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Settlement Tracking Summary Box */}
              {settlementResult.transfers.length > 0 && (
                <View style={styles.trackingSummaryCard}>
                  <View style={styles.trackingSummaryRow}>
                    <View style={styles.trackingSummaryCol}>
                      <Text style={styles.trackingSummaryLabel}>Remaining Unsettled</Text>
                      <Text style={styles.trackingSummaryAmount}>
                        {formatCurrency(unsettledAmountRemaining)}
                      </Text>
                    </View>
                    <View style={styles.trackingSummaryColRight}>
                      <Text style={styles.trackingSummaryStatusLabel}>Progress</Text>
                      <Text style={styles.trackingSummaryStatusValue}>
                        {settledTransfersCount}/{settlementResult.transfers.length} transfers
                      </Text>
                    </View>
                  </View>
                  {unsettledTransfersList.length === 0 ? (
                    <View style={styles.allSettledBanner}>
                      <MaterialIcons name="verified" size={16} color={Colors.success} />
                      <Text style={styles.allSettledText}>
                        All recommended transfers have been marked as settled!
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.trackingSummaryHint}>
                      Tap the checkmark on any transfer to record payment settlement.
                    </Text>
                  )}
                </View>
              )}

              {settlementResult.transfers.length === 0 ? (
                <View style={styles.settledNotice}>
                  <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                  <Text style={styles.settledNoticeText}>
                    All balances are equal. No transfers needed!
                  </Text>
                </View>
              ) : (
                settlementResult.transfers.map((t, idx) => {
                  const isMarked = settledTransferIndices[idx] || false;
                  return (
                    <View
                      key={idx}
                      style={[styles.transferCard, isMarked && styles.transferCardSettled]}
                    >
                      <View style={styles.transferContent}>
                        <View style={styles.transferHeaderRow}>
                          <Text
                            style={[
                              styles.transferInstruction,
                              isMarked && styles.transferTextStrikethrough,
                            ]}
                          >
                            <Text style={styles.debtorName}>{t.from_person}</Text> pays{" "}
                            <Text style={styles.creditorName}>{t.to_person}</Text>
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              isMarked ? styles.statusBadgeSettled : styles.statusBadgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isMarked ? styles.statusTextSettled : styles.statusTextPending,
                              ]}
                            >
                              {isMarked ? "Settled" : "Pending"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.transferSub}>Direct settlement transfer</Text>
                      </View>
                      <Text
                        style={[
                          styles.transferAmount,
                          isMarked && styles.transferTextStrikethrough,
                        ]}
                      >
                        {formatCurrency(t.amount)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleToggleSettled(idx)}
                        style={[
                          styles.settleCheckButton,
                          isMarked && styles.settleCheckButtonActive,
                        ]}
                        accessibilityLabel={`Mark transfer from ${t.from_person} to ${t.to_person} as ${isMarked ? "pending" : "settled"}`}
                      >
                        <MaterialIcons
                          name={isMarked ? "check" : "done"}
                          size={16}
                          color={isMarked ? Colors.onPrimary : Colors.secondaryText}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  segmentedBar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primaryContainer,
  },
  segmentText: {
    ...Typography.labelLarge,
    fontSize: 13,
    color: Colors.secondaryText,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    borderWidth: 1,
    borderColor: Colors.outline,
    padding: 18,
    marginBottom: 14,
    ...Elevation.level1,
  },
  stepTitle: {
    ...Typography.titleLarge,
    fontSize: 17,
    color: Colors.primaryText,
    marginBottom: 2,
  },
  stepSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.errorContainer,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorBoxText: {
    ...Typography.bodySmall,
    color: Colors.error,
    fontWeight: "500",
    flex: 1,
  },
  processingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Shapes.radiusMd,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
    gap: 12,
  },
  processingTitle: {
    ...Typography.titleMedium,
    color: Colors.primaryText,
    fontWeight: "700",
  },
  processingSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
  },
  uploadPromptBox: {
    height: 140,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderStyle: "dashed",
    borderRadius: Shapes.radiusMd,
    backgroundColor: Colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  uploadPromptTitle: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
  },
  receiptPreviewContainer: {
    borderRadius: Shapes.radiusMd,
    overflow: "hidden",
    backgroundColor: Colors.surfaceVariant,
    marginBottom: 16,
  },
  receiptImage: {
    width: "100%",
    height: 180,
  },
  receiptFileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    backgroundColor: Colors.surface,
  },
  receiptFileName: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    flex: 1,
  },
  imageActionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: Shapes.radiusSm,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surfaceVariant,
  },
  imagePickerButtonText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: "600",
  },
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Shapes.radiusMd,
    marginTop: 8,
  },
  primaryActionDisabled: {
    opacity: 0.6,
  },
  primaryActionButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  stepperNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backStepButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  backStepText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: "600",
  },
  stepIndicator: {
    ...Typography.labelSmall,
    color: Colors.secondaryText,
  },
  newSplitText: {
    ...Typography.labelMedium,
    color: Colors.primary,
    fontWeight: "700",
  },
  addPersonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  addPersonInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.primaryText,
    backgroundColor: Colors.surfaceVariant,
  },
  addPersonButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addPersonButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  personChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  personChipText: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    fontWeight: "600",
  },
  userSelectSection: {
    backgroundColor: Colors.secondaryContainer,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    marginBottom: 16,
  },
  userSelectLabel: {
    ...Typography.titleSmall,
    fontSize: 13,
    color: Colors.onSecondaryContainer,
    marginBottom: 8,
  },
  userSelectChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  userChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  userChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  userChipText: {
    ...Typography.bodySmall,
    color: Colors.primaryText,
    fontWeight: "500",
  },
  userChipTextActive: {
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 12,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
  },
  switchSubtitle: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  instructionContainer: {
    marginBottom: 16,
  },
  instructionLabel: {
    ...Typography.labelLarge,
    color: Colors.primaryText,
    marginBottom: 6,
  },
  instructionInput: {
    height: 90,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusSm,
    padding: 10,
    fontSize: 13,
    color: Colors.primaryText,
    backgroundColor: Colors.surfaceVariant,
  },
  billSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    marginBottom: 12,
  },
  billSummaryLeft: {
    flex: 1,
  },
  merchantTitle: {
    ...Typography.headlineMedium,
    fontSize: 18,
    color: Colors.primaryText,
  },
  billMetaText: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  reconciledPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Shapes.radiusSm,
  },
  reconciledText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: "700",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.warningContainer,
    padding: 10,
    borderRadius: Shapes.radiusSm,
    marginBottom: 12,
    gap: 8,
  },
  warningText: {
    ...Typography.bodySmall,
    color: Colors.warning,
    fontWeight: "600",
    flex: 1,
  },
  sharesHeader: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    marginBottom: 8,
  },
  sharesList: {
    gap: 8,
    marginBottom: 16,
  },
  shareItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusSm,
  },
  myShareItemRow: {
    backgroundColor: Colors.secondaryContainer,
    borderColor: Colors.secondary,
    borderWidth: 1,
  },
  sharePersonCol: {
    flex: 1,
  },
  sharePersonName: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
  },
  mySharePersonName: {
    color: Colors.onSecondaryContainer,
    fontWeight: "700",
  },
  shareItemCount: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  shareAmount: {
    ...Typography.amountMedium,
    color: Colors.primaryText,
  },
  myShareAmount: {
    color: Colors.primary,
    fontWeight: "800",
  },
  recordShareSection: {
    marginTop: 8,
  },
  recordShareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Shapes.radiusMd,
  },
  recordShareButtonSaved: {
    backgroundColor: Colors.success,
  },
  recordShareButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  inputLabel: {
    ...Typography.labelLarge,
    color: Colors.primaryText,
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.primaryText,
    backgroundColor: Colors.surfaceVariant,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  memberPill: {
    flex: 1,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  memberName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Colors.primaryText,
  },
  paymentInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusSm,
    paddingHorizontal: 8,
    width: 100,
    height: 40,
    marginRight: 8,
    backgroundColor: Colors.surfaceVariant,
  },
  currencyPrefix: {
    ...Typography.bodyMedium,
    color: Colors.secondaryText,
    fontWeight: "600",
    marginRight: 2,
  },
  paymentAmountInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.primaryText,
    textAlign: "right",
    paddingVertical: 0,
  },
  deleteMemberBtn: {
    padding: 6,
  },
  addMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  addMemberBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Shapes.radiusSm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addMemberBtnText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
    fontWeight: "700",
  },
  settlementMetricsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    marginBottom: 16,
  },
  settlementMetric: {
    flex: 1,
    alignItems: "center",
  },
  settlementMetricDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.outline,
  },
  settlementMetricLabel: {
    ...Typography.labelSmall,
    color: Colors.secondaryText,
    marginBottom: 2,
  },
  settlementMetricValue: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    fontWeight: "700",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  balancePersonName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Colors.primaryText,
  },
  balanceDetail: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Shapes.radiusSm,
  },
  badgeGreen: {
    backgroundColor: Colors.successContainer,
  },
  badgeRed: {
    backgroundColor: Colors.errorContainer,
  },
  badgeNeutral: {
    backgroundColor: Colors.surfaceVariant,
  },
  balanceBadgeText: {
    ...Typography.labelSmall,
    fontWeight: "700",
  },
  settledNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successContainer,
    padding: 12,
    borderRadius: Shapes.radiusSm,
  },
  settledNoticeText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: "600",
  },
  transferCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceVariant,
    padding: 12,
    borderRadius: Shapes.radiusSm,
    marginVertical: 4,
    gap: 8,
  },
  transferCardSettled: {
    opacity: 0.5,
  },
  transferContent: {
    flex: 1,
  },
  transferInstruction: {
    ...Typography.bodyMedium,
    color: Colors.primaryText,
  },
  debtorName: {
    fontWeight: "700",
    color: Colors.error,
  },
  creditorName: {
    fontWeight: "700",
    color: Colors.success,
  },
  transferSub: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontSize: 11,
  },
  transferAmount: {
    ...Typography.amountMedium,
    fontSize: 15,
    color: Colors.primaryText,
  },
  transferTextStrikethrough: {
    textDecorationLine: "line-through",
  },
  settleCheckButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  settleCheckButtonActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  settlementSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 4,
  },
  trackingOverviewPills: {
    flexDirection: "row",
    gap: 6,
  },
  pendingPill: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Shapes.radiusFull,
  },
  pendingPillText: {
    ...Typography.labelSmall,
    color: Colors.onSecondaryContainer,
    fontWeight: "600",
    fontSize: 11,
  },
  settledPill: {
    backgroundColor: Colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Shapes.radiusFull,
  },
  settledPillText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: "700",
    fontSize: 11,
  },
  trackingSummaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: Shapes.radiusSm,
    padding: 12,
    marginVertical: 8,
  },
  trackingSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingSummaryCol: {
    flex: 1,
  },
  trackingSummaryColRight: {
    alignItems: "flex-end",
  },
  trackingSummaryLabel: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontSize: 11,
  },
  trackingSummaryAmount: {
    ...Typography.titleSmall,
    color: Colors.primaryText,
    fontWeight: "700",
    marginTop: 2,
  },
  trackingSummaryStatusLabel: {
    ...Typography.bodySmall,
    color: Colors.secondaryText,
    fontSize: 11,
  },
  trackingSummaryStatusValue: {
    ...Typography.labelLarge,
    color: Colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  trackingSummaryHint: {
    ...Typography.bodySmall,
    color: Colors.tertiaryText,
    fontSize: 11,
    marginTop: 6,
  },
  allSettledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Shapes.radiusSm,
    marginTop: 8,
  },
  allSettledText: {
    ...Typography.bodySmall,
    color: Colors.success,
    fontWeight: "600",
    fontSize: 11,
    flex: 1,
  },
  transferHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Shapes.radiusFull,
  },
  statusBadgePending: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  statusBadgeSettled: {
    backgroundColor: Colors.successContainer,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusTextPending: {
    color: Colors.secondaryText,
  },
  statusTextSettled: {
    color: Colors.success,
  },
});
