import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, StyleSheet, Image,
  TouchableOpacity, Clipboard, Alert, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface MediaAsset {
  id: string;
  _id?: string;
  assetId?: string | number;
  mediaAssetId?: string | number;
  name?: string;
  originalFileName?: string;
  mediaType?: string;
  fileSize?: number;
  publicUrl?: string;
  category?: string;
  description?: string;
}

// The backend list can key an asset under any of these — resolve whichever
// exists so the DELETE URL never ends up as ".../undefined".
function assetId(a: MediaAsset): string | number | undefined {
  return a.id ?? a._id ?? a.assetId ?? a.mediaAssetId;
}

const MEDIA_COLORS: Record<string, { bg: string; text: string }> = {
  IMAGE:    { bg: "#dbeafe", text: "#3b82f6" },
  VIDEO:    { bg: "#f3e8ff", text: "#9333ea" },
  DOCUMENT: { bg: "#fef3c7", text: "#f59e0b" },
  AUDIO:    { bg: "#dcfce7", text: "#22c55e" },
};

const MEDIA_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  IMAGE: "image", VIDEO: "videocam", DOCUMENT: "document-text", AUDIO: "musical-notes",
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

export default function MediaLibraryScreen() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks which asset's "Copy URL" button should currently show the
  // "Copied" state, keyed by assetId(). Cleared automatically after a delay.
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/media-assets", { params: { page: 0, size: 50 } });
      const data = res.data ?? {};
      const items: MediaAsset[] = Array.isArray(data) ? data
        : Array.isArray(data.items) ? data.items
        : Array.isArray(data.content) ? data.content
        : [];
      setAssets(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load media assets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchAssets();
  }, [fetchAssets]));

  function copyUrl(asset: MediaAsset) {
    const url = asset.publicUrl || "";
    if (!url) { Alert.alert("No URL", "This asset has no public URL."); return; }
    try {
      Clipboard.setString(url);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      Alert.alert("Copy failed", "Could not copy the URL to your clipboard.");
      return;
    }
    const id = assetId(asset);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    setCopiedId(id ?? null);
    copiedTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleUpload() {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    } catch {
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
      await api.post("/api/media-assets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchAssets();
    } catch (err: any) {
      Alert.alert("Upload failed", err?.response?.data?.message || err?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  // Web parity (MediaLibrary.jsx deleteAsset): DELETE /api/media-assets/{id}.
  function confirmDelete(asset: MediaAsset) {
    const id = assetId(asset);
    const label = asset.name || asset.originalFileName || "this file";
    if (id == null || id === "") {
      console.warn("confirmDelete: no resolvable id on asset", asset);
      Alert.alert("Cannot delete", "This asset has no id to delete by.");
      return;
    }
    Alert.alert("Delete media", `Delete "${label}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            console.log("Deleting media asset", id);
            const res = await api.delete(`/api/media-assets/${id}`);
            console.log("Delete response:", res?.status, res?.data);
            // Optimistically drop it from local state right away so the UI
            // reflects the delete even if the refetch below has issues.
            setAssets((prev) => prev.filter((a) => assetId(a) !== id));
            // Reload from the backend so the list reflects the real state
            // (and so a failed-but-swallowed delete can't look successful).
            await fetchAssets();
          } catch (err: any) {
            console.error("Delete failed:", err?.response?.status, err?.response?.data || err);
            const status = err?.response?.status;
            Alert.alert(
              "Delete failed",
              err?.response?.data?.message ||
                err?.response?.data?.error ||
                `Could not delete media${status ? ` (HTTP ${status})` : ""}.`
            );
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingSpinner message="Loading media..." />;

  return (
    <SafeAreaView edges={[]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAssets(); }} />}
      <FlatList
        data={assets}
        keyExtractor={(item, index) => String(assetId(item) ?? index)}
        numColumns={2}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchAssets(); }}
        contentContainerStyle={assets.length === 0 ? styles.emptyContainer : { padding: 8 }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListEmptyComponent={<Text style={styles.emptyText}>No media files yet</Text>}
        renderItem={({ item }) => {
          const type = item.mediaType ?? "DOCUMENT";
          const colors = MEDIA_COLORS[type] || { bg: "#f1f5f9", text: "#64748b" };
          const iconName = MEDIA_ICONS[type] || "folder";
          const displayName = item.name || item.originalFileName || "Untitled";
          const isImage = type === "IMAGE" && !!item.publicUrl;
          const itemId = assetId(item);
          const isCopied = copiedId != null && itemId != null && copiedId === itemId;
          return (
            <View style={styles.card}>
              {isImage ? (
                <Image source={{ uri: item.publicUrl }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                  <Ionicons name={iconName} size={26} color={colors.text} />
                </View>
              )}

              <Text style={styles.name} numberOfLines={2}>{displayName}</Text>

              <View style={styles.metaRow}>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{type}</Text>
                </View>
                {!!item.fileSize && <Text style={styles.size}>{formatSize(item.fileSize)}</Text>}
              </View>

              {!!item.publicUrl && (
                <Text style={styles.urlPreview} numberOfLines={1}>{item.publicUrl}</Text>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.copyBtn,
                    !item.publicUrl && styles.copyBtnDisabled,
                    isCopied && styles.copyBtnCopied,
                  ]}
                  onPress={() => copyUrl(item)}
                  disabled={!item.publicUrl}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isCopied ? "checkmark" : "link-outline"}
                    size={14}
                    color={item.publicUrl ? "#fff" : "#9ca3af"}
                  />
                  <Text style={[styles.copyBtnText, !item.publicUrl && styles.copyBtnTextDisabled]}>
                    {isCopied ? "Copied" : "Copy URL"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDelete(item)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={15} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Upload FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleUpload}
        activeOpacity={0.85}
        disabled={uploading}
      >
        {uploading
          ? <ActivityIndicator color="#fff" />
          : <Ionicons name="cloud-upload-outline" size={24} color="#fff" />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    fontSize: 15, color: "#9ca3af", marginTop: 40,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    margin: 6, flex: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  thumbnail: { width: "100%", height: 96, borderRadius: 12, marginBottom: 10 },
  iconBox: {
    width: "100%", height: 72, borderRadius: 12, marginBottom: 10,
    alignItems: "center", justifyContent: "center",
  },
  name: {
    fontSize: 13.5, fontWeight: "600", color: "#111827", marginBottom: 6,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2.5 },
  badgeText: { fontSize: 10.5, fontWeight: "600" },
  size: { fontSize: 11.5, color: "#9ca3af" },
  urlPreview: { fontSize: 11.5, color: "#9ca3af", marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 6, alignItems: "stretch" },
  copyBtn: {
    flex: 1,
    backgroundColor: "#0f766e", borderRadius: 10,
    paddingVertical: 8, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 5,
  },
  copyBtnCopied: { backgroundColor: "#16a34a" },
  deleteBtn: {
    width: 38, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2",
  },
  copyBtnDisabled: { backgroundColor: "#f3f4f6" },
  copyBtnText: {
    fontSize: 12, fontWeight: "600", color: "#fff",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  copyBtnTextDisabled: { color: "#9ca3af" },
  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
});