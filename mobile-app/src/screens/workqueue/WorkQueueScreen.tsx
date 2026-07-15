import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  OVERDUE_TASKS: "alert-circle-outline",
  UNREAD_CHATS: "chatbubble-ellipses-outline",
  TODAY_TASKS: "time-outline",
  TODAY_APPOINTMENTS: "calendar-outline",
  NEW_LEADS: "person-add-outline",
  STALE_OPPORTUNITIES: "trending-down-outline",
};

const headingFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;

function priorityColor(priority?: string) {
  if (priority === "HIGH") return { bg: "#fee2e2", text: "#dc2626" };
  if (priority === "MEDIUM") return { bg: "#fef3c7", text: "#d97706" };
  return { bg: "rgba(118,118,128,0.08)", text: "#6b7280" };
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

// Collapsible dropdown section: only the compact header (icon, label,
// count, chevron) is visible until tapped, so the queue fits on one
// screen instead of every section dumping its items at once.
function SectionCard({
  section, open, onToggle,
}: {
  section: WorkSection;
  open: boolean;
  onToggle: () => void;
}) {
  const colors = SECTION_COLORS[section.key] || { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
  const icon = SECTION_ICONS[section.key] || "list-outline";
  const isEmpty = !section.items?.length;

  return (
    <View style={sectionStyles.card}>
      <TouchableOpacity style={sectionStyles.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={[sectionStyles.iconBox, { backgroundColor: colors.bg }]}>
          <Ionicons name={icon} size={20} color={colors.text} />
        </View>
        <View style={sectionStyles.titleArea}>
          <Text style={sectionStyles.title}>{section.label}</Text>
          {!!section.description && (
            <Text style={sectionStyles.desc} numberOfLines={open ? 2 : 1}>{section.description}</Text>
          )}
        </View>
        <View
          style={[
            sectionStyles.countBadge,
            section.count > 0 && { backgroundColor: colors.bg },
          ]}
        >
          <Text style={[sectionStyles.countText, section.count > 0 && { color: colors.text }]}>
            {section.count}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={17} color="#9ca3af" />
      </TouchableOpacity>

      {open &&
        (isEmpty ? (
          <View style={sectionStyles.empty}>
            <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
            <Text style={sectionStyles.emptyText}>Nothing pending here</Text>
          </View>
        ) : (
          <View style={sectionStyles.items}>
            {section.items.map((item, i) => (
              <WorkItemCard key={`${section.key}-item-${String(item.id ?? i)}`} item={item} />
            ))}
            {section.count > section.items.length && (
              <Text style={sectionStyles.moreText}>
                Showing {section.items.length} of {section.count}
              </Text>
            )}
          </View>
        ))}
    </View>
  );
}

export default function WorkQueueScreen() {
  const [queue, setQueue] = useState<WorkQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Dropdown state per section key. Sections start collapsed so the whole
  // queue fits on one screen; the first section with pending items opens
  // automatically on first load so the screen isn't just headers.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const autoOpenedRef = React.useRef(false);

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchWorkQueue();
      setQueue(data);
      if (!autoOpenedRef.current) {
        autoOpenedRef.current = true;
        const firstPending = data?.sections?.find((s: WorkSection) => (s.items?.length ?? 0) > 0);
        if (firstPending) setOpenSections({ [firstPending.key]: true });
      }
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
    <SafeAreaView style={styles.root} edges={[]}>
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
        {/* Summary header — slim bar, not a hero card */}
        <View style={styles.summaryCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.summaryTitle}>Today's View</Text>
            {!!queue?.recommendedFocus && (
              <Text style={styles.summaryDesc} numberOfLines={1}>{queue.recommendedFocus}</Text>
            )}
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryCount}>{queue?.totalCount ?? 0} pending</Text>
          </View>
        </View>

        {!!error && <ErrorBanner message={error} onRetry={() => load()} />}

        {queue?.sections?.map((section, idx) => (
          <SectionCard
            key={`section-${section.key ?? idx}`}
            section={section}
            open={!!openSections[section.key]}
            onToggle={() => toggleSection(section.key)}
          />
        ))}

        {!error && !queue?.sections?.length && (
          <View style={styles.allClearCard}>
            <Ionicons name="checkmark-circle" size={44} color="#16a34a" />
            <Text style={styles.allClearTitle}>All clear!</Text>
            <Text style={styles.allClearDesc}>No pending work for today.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  summaryLabel: {
    color: "#99f6e4",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: headingFont,
  },
  summaryTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.24 : undefined,
  },
  summaryDesc: { color: "#ccfbf1", fontSize: 12, marginTop: 1, letterSpacing: Platform.OS === "ios" ? -0.15 : undefined },
  summaryBadge: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  summaryCount: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "700",
    fontFamily: headingFont,
  },
  summaryPending: { color: "#99f6e4", fontSize: 11, fontWeight: "600" },
  allClearCard: { alignItems: "center", paddingVertical: 60, gap: 8 },
  allClearTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  allClearDesc: { fontSize: 13, color: "#6b7280", letterSpacing: Platform.OS === "ios" ? -0.15 : undefined },
});

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleArea: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  desc: { fontSize: 12.5, color: "#6b7280", marginTop: 2 },
  countBadge: { backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  items: { gap: 0 },
  moreText: { fontSize: 12, color: "#9ca3af", textAlign: "center", paddingTop: 10 },
  empty: {
    backgroundColor: "#f8f9fb",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  emptyText: { color: "#9ca3af", fontSize: 13, letterSpacing: Platform.OS === "ios" ? -0.15 : undefined },
});

const itemStyles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.12)",
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  info: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    fontFamily: headingFont,
    letterSpacing: Platform.OS === "ios" ? -0.32 : undefined,
  },
  desc: { fontSize: 13, color: "#6b7280", marginTop: 2, letterSpacing: Platform.OS === "ios" ? -0.15 : undefined },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: "#6b7280" },
});
