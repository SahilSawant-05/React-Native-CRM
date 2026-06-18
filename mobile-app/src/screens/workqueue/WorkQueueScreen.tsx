import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchWorkQueue } from "../../api/workQueue";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { WorkQueue, WorkSection, WorkItem } from "../../types";

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OVERDUE_TASKS: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  UNREAD_CHATS: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  TODAY_TASKS: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  TODAY_APPOINTMENTS: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  NEW_LEADS: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  STALE_OPPORTUNITIES: { bg: "#faf5ff", text: "#6d28d9", border: "#ddd6fe" },
};

const SECTION_ICONS: Record<string, string> = {
  OVERDUE_TASKS: "⚠️",
  UNREAD_CHATS: "💬",
  TODAY_TASKS: "⏰",
  TODAY_APPOINTMENTS: "📅",
  NEW_LEADS: "👤",
  STALE_OPPORTUNITIES: "🎯",
};

function priorityColor(priority?: string) {
  if (priority === "HIGH") return { bg: "#fef2f2", text: "#b91c1c" };
  if (priority === "MEDIUM") return { bg: "#fffbeb", text: "#92400e" };
  return { bg: "#f1f5f9", text: "#475569" };
}

function formatDateTime(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkItemCard({ item }: { item: WorkItem }) {
  const pc = priorityColor(item.priority);
  return (
    <View style={itemStyles.card}>
      <View style={itemStyles.row}>
        <View style={itemStyles.info}>
          <Text style={itemStyles.title} numberOfLines={1}>
            {item.title || item.contactName || "Untitled"}
          </Text>
          <Text style={itemStyles.desc} numberOfLines={2}>
            {item.description || item.contactPhone || "No details"}
          </Text>
        </View>
        <View style={[itemStyles.badge, { backgroundColor: pc.bg }]}>
          <Text style={[itemStyles.badgeText, { color: pc.text }]}>
            {item.priority || "LOW"}
          </Text>
        </View>
      </View>
      <View style={itemStyles.tags}>
        {item.contactName && (
          <View style={itemStyles.tag}><Text style={itemStyles.tagText}>{item.contactName}</Text></View>
        )}
        {item.status && (
          <View style={itemStyles.tag}><Text style={itemStyles.tagText}>{item.status}</Text></View>
        )}
        {(item.dueAt || item.occurredAt) && (
          <View style={itemStyles.tag}>
            <Text style={itemStyles.tagText}>{formatDateTime(item.dueAt || item.occurredAt)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SectionCard({ section }: { section: WorkSection }) {
  const colors = SECTION_COLORS[section.key] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
  const icon = SECTION_ICONS[section.key] || "📋";

  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.header}>
        <View style={[sectionStyles.iconBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
        <View style={sectionStyles.titleArea}>
          <Text style={sectionStyles.title}>{section.label}</Text>
          {!!section.description && (
            <Text style={sectionStyles.desc} numberOfLines={2}>{section.description}</Text>
          )}
        </View>
        <View style={sectionStyles.countBadge}>
          <Text style={sectionStyles.countText}>{section.count}</Text>
        </View>
      </View>

      {section.items?.length > 0 ? (
        <View style={sectionStyles.items}>
          {section.items.map((item, i) => (
            <WorkItemCard key={`${section.key}-${item.id ?? i}`} item={item} />
          ))}
          {section.count > section.items.length && (
            <Text style={sectionStyles.moreText}>
              Showing {section.items.length} of {section.count}
            </Text>
          )}
        </View>
      ) : (
        <View style={sectionStyles.empty}>
          <Text style={sectionStyles.emptyText}>Nothing pending here ✓</Text>
        </View>
      )}
    </View>
  );
}

export default function WorkQueueScreen() {
  const [queue, setQueue] = useState<WorkQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchWorkQueue();
      setQueue(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load work queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner message="Loading work queue…" />;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor="#0f766e"
          />
        }
      >
        {/* Summary header */}
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>WORK QUEUE</Text>
            <Text style={styles.summaryTitle}>Today's View</Text>
            {!!queue?.recommendedFocus && (
              <Text style={styles.summaryDesc}>{queue.recommendedFocus}</Text>
            )}
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryCount}>{queue?.totalCount ?? 0}</Text>
            <Text style={styles.summaryPending}>pending</Text>
          </View>
        </View>

        {!!error && <ErrorBanner message={error} onRetry={() => load()} />}

        {queue?.sections?.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}

        {!error && !queue?.sections?.length && (
          <View style={styles.allClearCard}>
            <Text style={styles.allClearIcon}>🎉</Text>
            <Text style={styles.allClearTitle}>All clear!</Text>
            <Text style={styles.allClearDesc}>No pending work for today.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: "#0f766e",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { color: "#99f6e4", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  summaryTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  summaryDesc: { color: "#ccfbf1", fontSize: 13, marginTop: 4, maxWidth: 220 },
  summaryBadge: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 12 },
  summaryCount: { color: "#fff", fontSize: 28, fontWeight: "900" },
  summaryPending: { color: "#99f6e4", fontSize: 12, fontWeight: "600" },
  allClearCard: { alignItems: "center", paddingVertical: 60, gap: 8 },
  allClearIcon: { fontSize: 48 },
  allClearTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  allClearDesc: { fontSize: 14, color: "#64748b" },
});

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleArea: { flex: 1 },
  title: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  desc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  countBadge: { backgroundColor: "#f1f5f9", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  items: { gap: 8 },
  moreText: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
  empty: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: "#94a3b8", fontSize: 13 },
});

const itemStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  desc: { fontSize: 13, color: "#64748b", marginTop: 2 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#f1f5f9", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: "#475569" },
});
