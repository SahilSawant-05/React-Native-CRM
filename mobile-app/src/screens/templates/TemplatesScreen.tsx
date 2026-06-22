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

interface Template {
  id: string;
  name: string;
  category: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  languageCode: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: "#dcfce7", text: "#22c55e" },
  PENDING: { bg: "#fef3c7", text: "#f59e0b" },
  REJECTED: { bg: "#fee2e2", text: "#ef4444" },
};

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/templates");
      const data = res.data ?? {};
      const items: Template[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : [];
      setTemplates(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTemplates();
    }, [fetchTemplates])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTemplates();
  };

  if (loading) return <LoadingSpinner message="Loading templates..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchTemplates(); }} />}
      <Text style={styles.sectionHeader}>WHATSAPP TEMPLATES</Text>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={templates.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No templates found</Text>}
        renderItem={({ item }) => {
          const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING;
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.badge, { backgroundColor: "#e0f2fe" }]}>
                  <Text style={[styles.badgeText, { color: "#0ea5e9" }]}>{item.category}</Text>
                </View>
                <Text style={styles.lang}>🌐 {item.languageCode}</Text>
              </View>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lang: { fontSize: 12, color: "#64748b", marginLeft: 8 },
});
