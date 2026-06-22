import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface MediaAsset {
  id: string;
  name: string;
  mediaType: "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO";
  fileSize: number;
}

const MEDIA_COLORS: Record<string, { bg: string; text: string }> = {
  IMAGE: { bg: "#dbeafe", text: "#3b82f6" },
  VIDEO: { bg: "#f3e8ff", text: "#9333ea" },
  DOCUMENT: { bg: "#fef3c7", text: "#f59e0b" },
  AUDIO: { bg: "#dcfce7", text: "#22c55e" },
};

const MEDIA_EMOJI: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  DOCUMENT: "📄",
  AUDIO: "🎵",
};

export default function MediaLibraryScreen() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/media-assets?page=0&size=20");
      const data = res.data ?? {};
      const items: MediaAsset[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : [];
      setAssets(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load media assets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAssets();
    }, [fetchAssets])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / 1024).toFixed(1) + " KB";
  };

  if (loading) return <LoadingSpinner message="Loading media..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchAssets(); }} />}
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={2}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={assets.length === 0 ? styles.emptyContainer : { padding: 8 }}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListEmptyComponent={<Text style={styles.emptyText}>No media files yet</Text>}
        renderItem={({ item }) => {
          const colors = MEDIA_COLORS[item.mediaType] || { bg: "#f1f5f9", text: "#64748b" };
          const emoji = MEDIA_EMOJI[item.mediaType] || "📁";
          return (
            <View style={styles.card}>
              <Text style={styles.emoji}>{emoji}</Text>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.text }]}>{item.mediaType}</Text>
                </View>
              </View>
              <Text style={styles.size}>{formatSize(item.fileSize)}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    margin: 8,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  emoji: { fontSize: 28, marginBottom: 8 },
  name: { fontSize: 13, fontWeight: "600", color: "#1e293b", marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 6 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  size: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
});
