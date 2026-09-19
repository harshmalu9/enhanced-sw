import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BillSplitResult, BillValidationResult } from "../types/bill";

interface SplitResultViewProps {
  splitResult: BillSplitResult;
  validation?: BillValidationResult | null;
  onReset: () => void;
}

export const SplitResultView: React.FC<SplitResultViewProps> = ({
  splitResult,
  validation,
  onReset,
}) => {
  const { bill, shares, assignments, reconciled_total } = splitResult;
  const currencySymbol = bill.currency === "INR" || !bill.currency ? "₹" : `${bill.currency} `;

  // Helper to format currency
  const fmt = (amt?: number | null) => {
    if (amt === undefined || amt === null) return "—";
    return `${currencySymbol}${amt.toFixed(2)}`;
  };

  // Build item price lookup from shares if available
  const itemPriceMap: Record<string, number> = {};
  shares.forEach((share) => {
    share.items.forEach((item) => {
      if (item.item_name && item.item_total_price) {
        itemPriceMap[item.item_name.toLowerCase()] = item.item_total_price;
      }
    });
  });

  return (
    <View style={styles.container}>
      {/* Top Banner with Merchant and Reconciled Total */}
      <View style={styles.mainCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.merchantName} numberOfLines={1}>
              {bill.merchant || "Receipt Bill"}
            </Text>
            <Text style={styles.billSubtitle}>Intelligent Bill Split Result</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{fmt(bill.total)}</Text>
          </View>
        </View>

        {/* Consistency Warning Card if extracted bill math was inconsistent */}
        {validation && !validation.is_consistent && (
          <View style={styles.warningBox}>
            <View style={styles.warningHeader}>
              <Text style={styles.warningIcon}>⚠</Text>
              <Text style={styles.warningTitle}>Receipt total needs review</Text>
            </View>
            <Text style={styles.warningMessage}>
              {validation.message ||
                "The extracted subtotal, tax and total do not fully reconcile."}
            </Text>
            {validation.difference !== undefined && validation.difference !== null && (
              <Text style={styles.warningDifference}>
                Difference: {fmt(validation.difference)}
              </Text>
            )}
          </View>
        )}

        {/* Breakdown of Subtotal / Tax / Discount if present */}
        {(bill.subtotal !== null || bill.tax !== null || bill.discount !== null || bill.tip !== null) && (
          <View style={styles.summaryMetaRow}>
            {bill.subtotal !== null && bill.subtotal !== undefined && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Subtotal</Text>
                <Text style={styles.metaValue}>{fmt(bill.subtotal)}</Text>
              </View>
            )}
            {bill.tax !== null && bill.tax !== undefined && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Tax/GST</Text>
                <Text style={styles.metaValue}>{fmt(bill.tax)}</Text>
              </View>
            )}
            {bill.discount !== null && bill.discount !== undefined && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Discount</Text>
                <Text style={styles.metaValue}>-{fmt(bill.discount)}</Text>
              </View>
            )}
            {bill.tip !== null && bill.tip !== undefined && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Tip</Text>
                <Text style={styles.metaValue}>{fmt(bill.tip)}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Per-Person Shares Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Per-Person Split</Text>
        <View style={styles.sharesList}>
          {shares.map((share, idx) => (
            <View key={`${share.person}-${idx}`} style={styles.shareRow}>
              <View style={styles.personCol}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {share.person.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.personName}>{share.person}</Text>
                  <Text style={styles.personItemsCount}>
                    {share.items.length} item{share.items.length === 1 ? "" : "s"}
                    {share.tax > 0 ? ` + ${fmt(share.tax)} tax` : ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.personShareAmount}>{fmt(share.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Reconciled Check Footer */}
        <View style={styles.reconciledFooter}>
          <View>
            <Text style={styles.reconciledLabel}>Total Reconciled</Text>
            <Text style={styles.reconciledAmount}>{fmt(reconciled_total)}</Text>
          </View>
          <View style={styles.reconciledBadge}>
            <Text style={styles.reconciledBadgeText}>✓ Split reconciled</Text>
          </View>
        </View>
      </View>

      {/* AI Consumption Mapping / Items Card */}
      <View style={styles.card}>
        <View style={styles.aiItemsHeader}>
          <Text style={styles.cardTitle}>Item Assignments</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI Assigned</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          How items were mapped to participants based on your instruction:
        </Text>

        <View style={styles.assignmentsList}>
          {assignments.map((assignment, idx) => {
            const price = itemPriceMap[assignment.item_name.toLowerCase()];
            return (
              <View key={`${assignment.item_name}-${idx}`} style={styles.assignmentItem}>
                <View style={styles.assignmentLeft}>
                  <Text style={styles.assignmentItemName}>
                    {assignment.item_name}
                  </Text>
                  <Text style={styles.assignmentPeople}>
                    Consumed by: {assignment.people.join(", ")}
                  </Text>
                </View>
                {price !== undefined && (
                  <Text style={styles.assignmentPrice}>{fmt(price)}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Reset Button */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={onReset}
        activeOpacity={0.8}
      >
        <Text style={styles.resetButtonText}>↻ Split Another Bill</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  merchantName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  billSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  totalLabel: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 6,
    color: "#d97706",
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b45309",
  },
  warningMessage: {
    fontSize: 12,
    color: "#78350f",
    lineHeight: 16,
  },
  warningDifference: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
    marginTop: 4,
  },
  summaryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  metaCol: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    marginBottom: 10,
  },
  sharesList: {
    marginTop: 10,
    gap: 12,
  },
  shareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  personCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  personName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  personItemsCount: {
    fontSize: 12,
    color: "#64748b",
  },
  personShareAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 14,
  },
  reconciledFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reconciledLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  reconciledAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  reconciledBadge: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reconciledBadgeText: {
    color: "#15803d",
    fontSize: 12,
    fontWeight: "700",
  },
  aiItemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiBadge: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiBadgeText: {
    color: "#7e22ce",
    fontSize: 10,
    fontWeight: "700",
  },
  assignmentsList: {
    gap: 8,
    marginTop: 4,
  },
  assignmentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
  },
  assignmentLeft: {
    flex: 1,
    marginRight: 8,
  },
  assignmentItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  assignmentPeople: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
    marginTop: 2,
  },
  assignmentPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  resetButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  resetButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
