import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
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
  amount: number | null;
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

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the opportunity array from whatever shape the API returns.
 * Handles:
 *   { content: [...] }   – Spring Page response
 *   { data: [...] }
 *   [...]                – plain array
 */
function extractOpportunities(responseData: unknown): Opportunity[] {
  if (Array.isArray(responseData)) return responseData;

  if (responseData && typeof responseData === "object") {
    const d = responseData as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as Opportunity[];
    if (Array.isArray(d.data)) return d.data as Opportunity[];
  }

  // Log in dev so you can see exactly what came back
  if (__DEV__) {
    console.warn("[PipelineScreen] Unexpected API shape:", JSON.stringify(responseData, null, 2));
  }

  return [];
}

function groupByStage(opps: Opportunity[]): { title: string; data: Opportunity[] }[] {
  const grouped: Record<string, Opportunity[]> = {};
  for (const opp of opps) {
    if (!grouped[opp.stage]) grouped[opp.stage] = [];
    grouped[opp.stage].push(opp);
  }
  return Object.entries(grouped).map(([title, data]) => ({ title, data }));
}

// ─── component ──────────────────────────────────────────────────────────────

export default function PipelineScreen() {
  const [sections, setSections] = useState<{ title: string; data: Opportunity[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);

      const res = await api.get("/api/opportunities?page=0&size=30");

      if (__DEV__) {
        console.log("[PipelineScreen] Raw response status:", res.status);
        console.log("[PipelineScreen] Raw response data:", JSON.stringify(res.data, null, 2));
      }

      const opps = extractOpportunities(res.data);
      setSections(groupByStage(opps));
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||   // backend error body
        e?.response?.statusText ||       // HTTP status text
        e?.message ||                    // JS error message
        "Failed to load pipeline";
      setError(message);

      if (__DEV__) {
        console.error("[PipelineScreen] API error:", e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSections([]); // clear stale data on focus
      fetchOpportunities();
    }, [fetchOpportunities])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOpportunities();
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null || isNaN(amount)) return "₹—";
    return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchOpportunities();
  };

  // Show spinner only on the very first load (not pull-to-refresh)
  if (loading && !refreshing) return <LoadingSpinner message="Loading pipeline..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={handleRetry} />}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={
          sections.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyTitle}>No opportunities yet</Text>
              <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionDot, { backgroundColor: STAGE_COLORS[section.title] || "#6366f1" }]} />
            <Text style={styles.sectionHeader}>{section.title.replace(/_/g, " ")}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const stageColor = STAGE_COLORS[item.stage] || "#6366f1";
          const priorityStyle = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.LOW;
          return (
            <View style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: stageColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: priorityStyle.text }]}>
                      {item.priority}
                    </Text>
                  </View>
                </View>
                <Text style={styles.contact}>👤 {item.contactName}</Text>
                <View style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: stageColor + "22" }]}>
                    <Text style={[styles.badgeText, { color: stageColor }]}>
                      {item.stage.replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyInner: { alignItems: "center", marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#94a3b8" },
  emptySubtitle: { fontSize: 13, color: "#cbd5e1", marginTop: 4 },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    flex: 1,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  contact: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 15, fontWeight: "700", color: "#0f766e" },
});