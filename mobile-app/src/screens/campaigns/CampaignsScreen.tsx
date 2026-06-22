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

interface Campaign {
  id: string;
  name: string;
  templateName: string;
  status: "SENT" | "SENDING" | "SCHEDULED" | "FAILED";
  recipientCount: number;
  sentCount: number;
  scheduledAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SENT: { bg: "#dcfce7", text: "#22c55e" },
  SENDING: { bg: "#dbeafe", text: "#3b82f6" },
  SCHEDULED: { bg: "#fef3c7", text: "#f59e0b" },
  FAILED: { bg: "#fee2e2", text: "#ef4444" },
};

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/campaigns?page=0&size=20");
      const data = res.data ?? {};
      const items: Campaign[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : [];
      setCampaigns(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchCampaigns();
    }, [fetchCampaigns])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCampaigns();
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <LoadingSpinner message="Loading campaigns..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchCampaigns(); }} />}
      <Text style={styles.sectionHeader}>CAMPAIGNS</Text>
      <FlatList
        data={campaigns}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={campaigns.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No campaigns yet</Text>}
        renderItem={({ item }) => {
          const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.SCHEDULED;
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.template}>📋 {item.templateName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>👥 {item.recipientCount} recipients</Text>
                <Text style={styles.stat}>✉️ {item.sentCount} sent</Text>
              </View>
              {item.scheduledAt && (
                <Text style={styles.date}>🕐 {formatDate(item.scheduledAt)}</Text>
              )}
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
  sectionHeader: { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  template: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 16, marginBottom: 6 },
  stat: { fontSize: 12, color: "#64748b" },
  date: { fontSize: 12, color: "#94a3b8" },
});
