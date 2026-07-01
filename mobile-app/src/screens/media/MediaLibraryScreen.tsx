import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Image,
  TouchableOpacity, Clipboard, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface MediaAsset {
  id: string;
  name?: string;
  originalFileName?: string;
  mediaType?: string;
  fileSize?: number;
  publicUrl?: string;
  category?: string;
  description?: string;
}

const MEDIA_COLORS: Record<string, { bg: string; text: string }> = {
  IMAGE:    { bg: "#dbeafe", text: "#3b82f6" },
  VIDEO:    { bg: "#f3e8ff", text: "#9333ea" },
  DOCUMENT: { bg: "#fef3c7", text: "#f59e0b" },
  AUDIO:    { bg: "#dcfce7", text: "#22c55e" },
};

const MEDIA_EMOJI: Record<string, string> = {
  IMAGE: "🖼️", VIDEO: "🎬", DOCUMENT: "📄", AUDIO: "🎵",
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

function copyUrl(asset: MediaAsset) {
  const url = asset.publicUrl || "";
  if (!url) { Alert.alert("No URL", "This asset has no public URL."); return; }
  Clipboard.setString(url);
  Alert.alert("Copied", "Public URL copied to clipboard.");
}

export default function MediaLibraryScreen() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <LoadingSpinner message="Loading media..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAssets(); }} />}
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={2}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchAssets(); }}
        contentContainerStyle={assets.length === 0 ? styles.emptyContainer : { padding: 8 }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListEmptyComponent={<Text style={styles.emptyText}>No media files yet</Text>}
        renderItem={({ item }) => {
          const type = item.mediaType ?? "DOCUMENT";
          const colors = MEDIA_COLORS[type] || { bg: "#f1f5f9", text: "#64748b" };
          const emoji = MEDIA_EMOJI[type] || "📁";
          const displayName = item.name || item.originalFileName || "Untitled";
          const isImage = type === "IMAGE" && !!item.publicUrl;
          return (
            <View style={styles.card}>
              {isImage ? (
                <Image source={{ uri: item.publicUrl }} style={styles.thumbnail} resizeMode="cover" />
              ) : (
                <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                  <Text style={styles.emoji}>{emoji}</Text>
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

              <TouchableOpacity
                style={[styles.copyBtn, !item.publicUrl && styles.copyBtnDisabled]}
                onPress={() => copyUrl(item)}
                disabled={!item.publicUrl}
                activeOpacity={0.75}
              >
                <Text style={styles.copyBtnText}>📋 Copy URL</Text>
              </TouchableOpacity>
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
          : <Text style={styles.fabText}>＋</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    margin: 6, flex: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  thumbnail: { width: "100%", height: 90, borderRadius: 8, marginBottom: 8 },
  iconBox: {
    width: "100%", height: 70, borderRadius: 8, marginBottom: 8,
    alignItems: "center", justifyContent: "center",
  },
  emoji: { fontSize: 28 },
  name: { fontSize: 12, fontWeight: "600", color: "#1e293b", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  badge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  size: { fontSize: 10, color: "#94a3b8" },
  urlPreview: { fontSize: 10, color: "#94a3b8", marginBottom: 8 },
  copyBtn: {
    backgroundColor: "#0f766e", borderRadius: 8,
    paddingVertical: 7, alignItems: "center",
  },
  copyBtnDisabled: { backgroundColor: "#e2e8f0" },
  copyBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f766e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 32 },
});
