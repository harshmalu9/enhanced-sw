import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ReceiptFile } from "../types/bill";

interface ReceiptUploaderProps {
  receipt: ReceiptFile | null;
  onSelectReceipt: (receipt: ReceiptFile) => void;
  onContinue: () => void;
  isLoading?: boolean;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  receipt,
  onSelectReceipt,
  onContinue,
  isLoading = false,
}) => {
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert("Permission to access gallery is required to select a receipt.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const name = asset.fileName || uri.split("/").pop() || "receipt.jpg";
        const type = asset.mimeType || "image/jpeg";

        let webFile: File | undefined = undefined;
        if (asset.file) {
          webFile = asset.file as unknown as File;
        }

        onSelectReceipt({
          uri,
          name,
          type,
          file: webFile,
        });
      }
    } catch (err) {
      console.error("Error picking image:", err);
      alert("Failed to open image picker.");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Stage 1: Receipt Upload</Text>
      <Text style={styles.sectionSubtitle}>
        Upload or choose a photo of your receipt to get started.
      </Text>

      <TouchableOpacity
        style={styles.uploadArea}
        onPress={pickImage}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        {receipt?.uri ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: receipt.uri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>✓ Receipt Selected</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadMainText}>Tap to Select Receipt</Text>
            <Text style={styles.uploadSubText}>Supports JPG, PNG, WEBP</Text>
          </View>
        )}
      </TouchableOpacity>

      {receipt && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileInfoLabel}>Selected:</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {receipt.name}
          </Text>
          <TouchableOpacity
            style={styles.changeButton}
            onPress={pickImage}
            disabled={isLoading}
          >
            <Text style={styles.changeButtonText}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.continueButton,
          (!receipt || isLoading) && styles.buttonDisabled,
        ]}
        onPress={onContinue}
        disabled={!receipt || isLoading}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>
          {isLoading ? "Processing..." : "Continue →"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  uploadMainText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
    marginBottom: 4,
  },
  uploadSubText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  previewContainer: {
    width: "100%",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
  },
  selectedBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  selectedBadgeText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "600",
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  fileInfoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginRight: 6,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  changeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeButtonText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  continueButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
