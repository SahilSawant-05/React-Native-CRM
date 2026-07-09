import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchOpportunities } from "../../api/opportunities";
import { Opportunity } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import AiAssistPanel from "../../components/ai/AiAssistPanel";

const STAGES = ["", "NEW", "QUALIFIED", "FOLLOW_UP", "WON", "LOST"];

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: "#eff6ff", text: "#1d4ed8" },
  QUALIFIED: { bg: "#f0fdf4", text: "#15803d" },
  FOLLOW_UP: { bg: "#fffbeb", text: "#92400e" },
  WON: { bg: "#dcfce7", text: "#166534" },
  LOST: { bg: "#fef2f2", text: "#b91c1c" },
};

function formatCurrency(amount?: number) {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function OpportunityCard({ item }: { item: Opportunity }) {
  const sc = STAGE_COLORS[item.stage ?? ""] || { bg: "#f1f5f9", text: "#475569" };
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setAiOpen((v) => !v)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.stageBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.stageText, { color: sc.text }]}>{item.stage || "—"}</Text>
          </View>
          <Text style={styles.aiChevron}>{aiOpen ? "✨" : "✨"}</Text>
        </View>
        {!!item.contactName && <Text style={styles.contact}>👤 {item.contactName}</Text>}
        <View style={styles.cardFooter}>
          {!!item.amount && (
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          )}
          {!!item.closeDate && (
            <Text style={styles.date}>📅 {new Date(item.closeDate).toLocaleDateString()}</Text>
          )}
        </View>
      </TouchableOpacity>
      {aiOpen && (
        <View style={styles.aiWrap}>
          <AiAssistPanel
            contactId={item.contactId}
            title="AI Opportunity Summary"
            contextPrompt={
              `Opportunity: ${item.title}. Stage: ${item.stage || "N/A"}. ` +
              `Contact: ${item.contactName || "N/A"}. ` +
              `Value: ${item.amount ? formatCurrency(item.amount) : "N/A"}. ` +
              `Close Date: ${item.closeDate ? new Date(item.closeDate).toLocaleDateString() : "N/A"}. ` +
              `Recommend the next best CRM action for this opportunity.`
            }
            replyPrompt={
              `Opportunity: ${item.title}. Stage: ${item.stage || "N/A"}. ` +
              `Contact: ${item.contactName || "N/A"}. ` +
              `Write a short, warm follow-up message to advance this deal.`
            }
          />
        </View>
      )}
    </View>
  );
}

export default function OpportunitiesScreen() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p = 0, s = "") => {
    if (p === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const data = await fetchOpportunities({ page: p, size: 20, stage: s || undefined });
      const content = data.content ?? [];
      setItems((prev) => (p === 0 ? content : [...prev, ...content]));
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load opportunities");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0, stage); }, []);

  function selectStage(s: string) {
    setStage(s);
    load(0, s);
  }

  if (loading) return <LoadingSpinner message="Loading opportunities…" />;

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      {/* Stage filter */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STAGES.map((s) => (
            <TouchableOpacity
              key={s || "ALL"}
              style={[styles.filterChip, stage === s && styles.filterChipActive]}
              onPress={() => selectStage(s)}
            >
              <Text style={[styles.filterText, stage === s && styles.filterTextActive]}>
                {s || "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!error && <ErrorBanner message={error} onRetry={() => load(0, stage)} />}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id ?? item._id ?? item.title ?? index)}
        renderItem={({ item }) => <OpportunityCard item={item} />}
        onEndReached={() => { if (!loadingMore && page + 1 < totalPages) load(page + 1, stage); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No opportunities found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  filterWrap: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  filterTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0f172a" },
  stageBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  stageText: { fontSize: 11, fontWeight: "700" },
  contact: { fontSize: 13, color: "#64748b" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontSize: 15, fontWeight: "800", color: "#0f766e" },
  date: { fontSize: 12, color: "#64748b" },
  aiChevron: { fontSize: 14, marginLeft: 4 },
  aiWrap: { marginTop: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyText: { color: "#94a3b8", fontSize: 15 },
});
