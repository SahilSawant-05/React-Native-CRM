import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface Opportunity {
  id: string;
  title: string;
  contactName: string;
  stage: string;
  amount: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

const STAGE_COLORS: Record<string, string> = {
  LEAD: "#6366f1",
  QUALIFIED: "#3b82f6",
  PROPOSAL: "#f59e0b",
  NEGOTIATION: "#f97316",
  CLOSED_WON: "#22c55e",
  CLOSED_LOST: "#ef4444",
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "#fee2e2", text: "#ef4444" },
  MEDIUM: { bg: "#fef3c7", text: "#f59e0b" },
  LOW: { bg: "#f1f5f9", text: "#94a3b8" },
};

export default function PipelineScreen() {
  const [sections, setSections] = useState<{ title: string; data: Opportunity[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<{ content: Opportunity[] }>("/api/opportunities?page=0&size=30");
      const grouped: Record<string, Opportunity[]> = {};
      for (const opp of res.data.content) {
        if (!grouped[opp.stage]) grouped[opp.stage] = [];
        grouped[opp.stage].push(opp);
      }
      setSections(Object.entries(grouped).map(([title, data]) => ({ title, data })));
    } catch (e: any) {
      setError(e?.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchOpportunities();
    }, [fetchOpportunities])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOpportunities();
  };

  const formatCurrency = (amount: number) =>
    "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (loading) return <LoadingSpinner message="Loading pipeline..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchOpportunities(); }} />}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No opportunities yet</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const stageColor = STAGE_COLORS[item.stage] || "#6366f1";
          const priorityStyle = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.LOW;
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: priorityStyle.text }]}>{item.priority}</Text>
                </View>
              </View>
              <Text style={styles.contact}>👤 {item.contactName}</Text>
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: stageColor + "22" }]}>
                  <Text style={[styles.badgeText, { color: stageColor }]}>{item.stage}</Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  contact: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 15, fontWeight: "700", color: "#0f766e" },
});
