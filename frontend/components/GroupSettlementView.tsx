import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GroupSettlementRequest, GroupSettlementResponse, ParticipantPayment } from "../types/settlement";
import { simplifyDebts, ApiError } from "../services/api";

export const GroupSettlementView: React.FC = () => {
  const [title, setTitle] = useState<string>("Weekend Trip Expenses");
  const [payments, setPayments] = useState<ParticipantPayment[]>([
    { person: "Rahul", amount_paid: 1200 },
    { person: "Priya", amount_paid: 400 },
    { person: "Amit", amount_paid: 200 },
  ]);

  const [newPersonName, setNewPersonName] = useState<string>("");
  const [newPersonAmount, setNewPersonAmount] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroupSettlementResponse | null>(null);

  const handleAddParticipant = () => {
    if (!newPersonName.trim()) {
      Alert.alert("Invalid Input", "Please enter a participant name.");
      return;
    }
    const amt = parseFloat(newPersonAmount || "0");
    if (isNaN(amt) || amt < 0) {
      Alert.alert("Invalid Amount", "Please enter a valid non-negative amount paid.");
      return;
    }

    if (payments.some((p) => p.person.trim().toLowerCase() === newPersonName.trim().toLowerCase())) {
      Alert.alert("Duplicate Name", "A participant with this name is already in the list.");
      return;
    }

    setPayments((prev) => [...prev, { person: newPersonName.trim(), amount_paid: amt }]);
    setNewPersonName("");
    setNewPersonAmount("");
  };

  const handleRemoveParticipant = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePayment = (index: number, newAmountStr: string) => {
    const parsed = parseFloat(newAmountStr);
    setPayments((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        amount_paid: isNaN(parsed) ? 0 : parsed,
      };
      return copy;
    });
  };

  const handleLoadPreset = (preset: "trip" | "dinner") => {
    if (preset === "trip") {
      setTitle("Goa Trip Settlement");
      setPayments([
        { person: "Rahul (A)", amount_paid: 900 },
        { person: "Priya (B)", amount_paid: 300 },
        { person: "Amit (C)", amount_paid: 0 },
      ]);
    } else {
      setTitle("Team Dinner Split");
      setPayments([
        { person: "Alice", amount_paid: 2400 },
        { person: "Bob", amount_paid: 800 },
        { person: "Charlie", amount_paid: 0 },
        { person: "Diana", amount_paid: 1200 },
      ]);
    }
    setResult(null);
    setError(null);
  };

  const handleCalculateSettlement = async () => {
    if (payments.length < 2) {
      setError("Please add at least 2 participants to calculate debt settlement.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: GroupSettlementRequest = {
        title: title.trim() || "Group Settlement",
        payments,
      };

      const res = await simplifyDebts(payload);
      setResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to calculate simplified debts.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.viewTitle}>Debt Simplification Engine</Text>
          <Text style={styles.viewSubtitle}>
            Minimum cash-flow settlement algorithm solving multi-payer group balances
          </Text>
        </View>
      </View>

      {/* Preset Quick Loader Buttons */}
      <View style={styles.presetRow}>
        <Text style={styles.presetLabel}>Quick Presets:</Text>
        <TouchableOpacity
          style={styles.presetBtn}
          onPress={() => handleLoadPreset("trip")}
          activeOpacity={0.7}
        >
          <Text style={styles.presetBtnText}>🏖️ 3-Person Spec Example</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetBtn}
          onPress={() => handleLoadPreset("dinner")}
          activeOpacity={0.7}
        >
          <Text style={styles.presetBtnText}>🍕 4-Person Dinner</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Input Form Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Group Event & Payments</Text>
        
        <Text style={styles.inputLabel}>Event / Trip Name</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Goa Trip 2026"
        />

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>
          Who Paid What ({payments.length} participants)
        </Text>

        {payments.map((p, idx) => (
          <View key={idx} style={styles.paymentRow}>
            <View style={styles.personPill}>
              <Text style={styles.personPillText}>{p.person}</Text>
            </View>
            <View style={styles.paymentInputWrapper}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={String(p.amount_paid)}
                onChangeText={(val) => handleUpdatePayment(idx, val)}
              />
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveParticipant(idx)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Participant Input */}
        <View style={styles.addParticipantRow}>
          <TextInput
            style={[styles.textInput, { flex: 1, marginRight: 8 }]}
            placeholder="Participant name"
            value={newPersonName}
            onChangeText={setNewPersonName}
          />
          <TextInput
            style={[styles.textInput, { width: 90, marginRight: 8 }]}
            placeholder="Paid (₹)"
            keyboardType="numeric"
            value={newPersonAmount}
            onChangeText={setNewPersonAmount}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddParticipant}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.calculateBtn, (payments.length < 2 || isLoading) && styles.btnDisabled]}
          onPress={handleCalculateSettlement}
          disabled={payments.length < 2 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.calculateBtnText}>⚡ Calculate Simplified Settlement</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results Section */}
      {result && (
        <View style={styles.resultContainer}>
          {/* Summary Card */}
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>✨ Settlement Plan</Text>
              <TouchableOpacity onPress={handleReset} style={styles.resetLink}>
                <Text style={styles.resetLinkText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Group Spent</Text>
                <Text style={styles.statValue}>
                  ₹{result.total_group_spent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Fair Share / Person</Text>
                <Text style={styles.statValue}>
                  ₹{(result.fair_share_per_person || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Min Transfers</Text>
                <Text style={styles.statValue}>{result.total_transfers_count}</Text>
              </View>
            </View>

            {/* Individual Balances */}
            <Text style={styles.subSectionTitle}>Individual Net Balances</Text>
            {result.balances.map((b, i) => {
              const isCreditor = b.net_balance > 0.01;
              const isDebtor = b.net_balance < -0.01;
              return (
                <View key={i} style={styles.balanceItem}>
                  <View>
                    <Text style={styles.balancePerson}>{b.person}</Text>
                    <Text style={styles.balanceDetail}>
                      Paid ₹{b.amount_paid.toLocaleString("en-IN")} • Share ₹{b.fair_share.toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.netBadge,
                      isCreditor
                        ? styles.netBadgeGreen
                        : isDebtor
                        ? styles.netBadgeRed
                        : styles.netBadgeGray,
                    ]}
                  >
                    <Text
                      style={[
                        styles.netBadgeText,
                        isCreditor
                          ? { color: "#16a34a" }
                          : isDebtor
                          ? { color: "#dc2626" }
                          : { color: "#64748b" },
                      ]}
                    >
                      {isCreditor
                        ? `Gets back +₹${b.net_balance.toFixed(2)}`
                        : isDebtor
                        ? `Owes -₹${Math.abs(b.net_balance).toFixed(2)}`
                        : "Settled (₹0.00)"}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Transfer instructions */}
            <Text style={[styles.subSectionTitle, { marginTop: 18 }]}>
              Optimal Settlement Transfers (Who Pays Whom)
            </Text>

            {result.transfers.length === 0 ? (
              <View style={styles.settledNotice}>
                <Text style={styles.settledNoticeText}>
                  🎉 All balances are already equal! No money transfers needed.
                </Text>
              </View>
            ) : (
              result.transfers.map((t, idx) => (
                <View key={idx} style={styles.transferCard}>
                  <View style={styles.transferIconWrapper}>
                    <Text style={styles.transferIcon}>💸</Text>
                  </View>
                  <View style={styles.transferContent}>
                    <Text style={styles.transferInstruction}>
                      <Text style={styles.debtorName}>{t.from_person}</Text> pays{" "}
                      <Text style={styles.creditorName}>{t.to_person}</Text>
                    </Text>
                    <Text style={styles.transferSubText}>
                      Direct settlement transfer
                    </Text>
                  </View>
                  <Text style={styles.transferAmount}>
                    ₹{t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 12,
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  viewSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  presetBtn: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  presetBtnText: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  personPill: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  personPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  paymentInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    width: 110,
    marginRight: 8,
  },
  currencyPrefix: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginRight: 2,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    color: "#0f172a",
    textAlign: "right",
  },
  removeBtn: {
    padding: 6,
  },
  removeBtnText: {
    fontSize: 16,
    color: "#94a3b8",
  },
  addParticipantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  addBtn: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 13,
  },
  calculateBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  calculateBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultContainer: {
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  resetLink: {
    padding: 4,
  },
  resetLinkText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryStatsRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  balanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  balancePerson: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  balanceDetail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  netBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  netBadgeGreen: {
    backgroundColor: "#dcfce7",
  },
  netBadgeRed: {
    backgroundColor: "#fee2e2",
  },
  netBadgeGray: {
    backgroundColor: "#f1f5f9",
  },
  netBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  settledNotice: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginVertical: 8,
  },
  settledNoticeText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
  },
  transferCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
  },
  transferIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  transferIcon: {
    fontSize: 16,
  },
  transferContent: {
    flex: 1,
  },
  transferInstruction: {
    fontSize: 13,
    color: "#0f172a",
  },
  debtorName: {
    fontWeight: "700",
    color: "#dc2626",
  },
  creditorName: {
    fontWeight: "700",
    color: "#16a34a",
  },
  transferSubText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  transferAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 8,
  },
});
