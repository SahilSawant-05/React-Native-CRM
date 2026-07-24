import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import AiAssistPanel from "../../components/ai/AiAssistPanel";
import { DrawerCtx } from "../../navigation/AdminDrawer";
import { AgentDrawerCtx } from "../../navigation/AgentDrawer";

const androidMedium = Platform.OS === "android" ? "sans-serif-medium" : undefined;

interface QueueItem {
  id: string | number;
  groupKey?: string;
  reasonKey?: string;
  reasonLabel?: string;
  priority?: number;
  contactId?: string | number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  opportunityId?: string | number;
  opportunityTitle?: string;
  pipelineName?: string;
  stage?: string;
  leadScore?: number | null;
  leadScoreReason?: string;
  leadScoreUpdatedAt?: string;
  leadSource?: string;
  city?: string;
  dueAt?: string;
  lastActivityAt?: string;
  summary?: string;
  sectionKey?: string;
  sectionLabel?: string;
  hasOpenTask?: boolean;
  hasOpenOpportunity?: boolean;
  openOpportunityId?: string | number;
  openOpportunityTitle?: string;
  openOpportunityStage?: string;
  targetPath?: string;
}

const GROUPS = [
  { key: "URGENT", label: "Urgent", helper: "Start here. These need same-day attention.", icon: "alert-circle-outline" as const, color: "#be123c", bg: "#fff1f2" },
  { key: "TODAY",  label: "Today",  helper: "Good opportunities for a timely follow-up.",  icon: "time-outline" as const,         color: "#b45309", bg: "#fffbeb" },
  { key: "WATCH",  label: "Watch",  helper: "Review these when urgent work is cleared.",   icon: "eye-outline" as const,          color: "#0f766e", bg: "#f0fdfa" },
];

const INBOX_GROUPS = [
  { key: "1_HOT",         label: "Hot Leads",       helper: "Score 80+ and ready for fast follow-up.",           icon: "flame-outline" as const,        color: "#be123c", bg: "#fff1f2" },
  { key: "2_WARM",        label: "Warm Leads",      helper: "Score 50-79. Keep the conversation moving.",        icon: "sunny-outline" as const,        color: "#b45309", bg: "#fffbeb" },
  { key: "3_FOLLOW_UP",   label: "Needs Follow-up", helper: "Scored leads without open task or opportunity.",    icon: "checkmark-circle-outline" as const, color: "#4338ca", bg: "#eef2ff" },
  { key: "4_NEWLY_SCORED",label: "Newly Scored",    helper: "Scores updated in the last 7 days.",                icon: "sparkles-outline" as const,     color: "#0f766e", bg: "#f0fdfa" },
  { key: "5_NURTURE",     label: "Nurture Later",   helper: "Lower-score leads for later campaigns.",            icon: "leaf-outline" as const,         color: "#4b5563", bg: "#f8fafc" },
];

function formatDateTime(value?: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function errMsg(err: any): string {
  const data = err?.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || err?.message || "Something went wrong";
}

function recommendationPrompt(item: QueueItem): string {
  return [
    "Act as a CRM sales coach. Give the next best action for this record.",
    "",
    `Reason: ${item.reasonLabel || item.reasonKey || "CRM follow-up"}`,
    `Contact: ${item.contactName || "Unknown"}`,
    item.contactPhone ? `Phone: ${item.contactPhone}` : "",
    item.opportunityTitle ? `Opportunity: ${item.opportunityTitle}` : "",
    item.pipelineName ? `Pipeline: ${item.pipelineName}` : "",
    item.stage ? `Stage: ${item.stage}` : "",
    item.leadScore != null ? `Lead score: ${item.leadScore}` : "",
    item.dueAt ? `Due at: ${formatDateTime(item.dueAt)}` : "",
    item.lastActivityAt ? `Last activity: ${formatDateTime(item.lastActivityAt)}` : "",
    item.summary ? `CRM context: ${item.summary}` : "",
    "",
    "Return: 1 short summary, 3 action bullets, and one ready-to-send WhatsApp/email follow-up message.",
  ].filter(Boolean).join("\n");
}

function replyPrompt(item: QueueItem): string {
  return [
    "Write a concise customer follow-up message for this CRM record.",
    item.summary || "",
    item.opportunityTitle ? `Opportunity: ${item.opportunityTitle}` : "",
    item.stage ? `Stage: ${item.stage}` : "",
    "Make it polite, practical, and ask one clear next-step question.",
  ].filter(Boolean).join("\n");
}

// Normalise a lead-inbox item into the same shape the AI panel expects
function toAiContext(item: QueueItem | null): QueueItem | null {
  if (!item) return null;
  if (item.reasonKey) return item;
  return {
    id: item.id,
    reasonKey: item.sectionKey,
    reasonLabel: item.sectionLabel,
    priority: item.leadScore ?? undefined,
    contactId: item.contactId,
    contactName: item.contactName,
    contactPhone: item.contactPhone,
    opportunityId: item.openOpportunityId,
    opportunityTitle: item.openOpportunityTitle,
    stage: item.openOpportunityStage || item.stage,
    summary: item.summary,
    leadScore: item.leadScore,
  };
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function QueueCard({
  item, isInbox, selected, onSelect, onOpen, onCreateTask, taskCreating,
}: {
  item: QueueItem;
  isInbox: boolean;
  selected: boolean;
  onSelect: (i: QueueItem) => void;
  onOpen: (i: QueueItem) => void;
  onCreateTask: (i: QueueItem) => void;
  taskCreating: string | number;
}) {
  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      {/* chips */}
      <View style={styles.chipRow}>
        {isInbox ? (
          <>
            <Chip label={`Score ${item.leadScore ?? "-"}`} color="#4338ca" bg="#eef2ff" />
            {!!item.leadSource && <Chip label={item.leadSource} color="#4b5563" bg="#f1f5f9" />}
            {item.hasOpenTask && <Chip label="Task open" color="#15803d" bg="#dcfce7" />}
            {item.hasOpenOpportunity && <Chip label="Deal open" color="#0f766e" bg="#ccfbf1" />}
          </>
        ) : (
          <>
            {!!(item.reasonLabel || item.reasonKey) && (
              <Chip label={(item.reasonLabel || item.reasonKey)!} color="#4b5563" bg="#f1f5f9" />
            )}
            <Chip label={`Priority ${item.priority ?? 0}`} color="#0f766e" bg="#ccfbf1" />
            {item.leadScore != null && <Chip label={`Score ${item.leadScore}`} color="#4338ca" bg="#eef2ff" />}
          </>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {(isInbox ? item.contactName : item.opportunityTitle || item.contactName) || "CRM record"}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {isInbox
          ? [item.contactPhone || item.contactEmail || "No contact detail", item.city, item.openOpportunityStage || item.stage].filter(Boolean).join(" · ")
          : [item.contactName || "Unknown contact", item.pipelineName, item.stage].filter(Boolean).join(" · ")}
      </Text>

      {!!item.summary && (
        <Text style={styles.cardSummary} numberOfLines={3}>{item.summary}</Text>
      )}

      {(item.dueAt || item.lastActivityAt) && (
        <View style={styles.timeRow}>
          {!!item.dueAt && (
            <View style={styles.timePill}>
              <Ionicons name="time-outline" size={13} color="#6b7280" />
              <Text style={styles.timeText}>Due {formatDateTime(item.dueAt)}</Text>
            </View>
          )}
          {!!item.lastActivityAt && (
            <View style={styles.timePill}>
              <Ionicons name="calendar-outline" size={13} color="#6b7280" />
              <Text style={styles.timeText}>{formatDateTime(item.lastActivityAt)}</Text>
            </View>
          )}
        </View>
      )}

      {/* actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.aiBtn} onPress={() => onSelect(item)} activeOpacity={0.8}>
          <Ionicons name="sparkles-outline" size={14} color="#fff" />
          <Text style={styles.aiBtnText}>AI Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => onOpen(item)} activeOpacity={0.8}>
          <Text style={styles.ghostBtnText}>Open</Text>
          <Ionicons name="arrow-forward" size={14} color="#374151" />
        </TouchableOpacity>
        {!!item.contactId && (
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => onCreateTask(item)}
            disabled={taskCreating === item.id}
            activeOpacity={0.8}
          >
            {taskCreating === item.id
              ? <ActivityIndicator size="small" color="#374151" />
              : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#374151" />
                  <Text style={styles.ghostBtnText}>Follow-up</Text>
                </>
              )}
          </TouchableOpacity>
        )}
      </View>

      {/* Inline AI panel for the selected card — mobile replaces the web sidebar */}
      {selected && (
        <View style={{ marginTop: 10 }}>
          <AiAssistPanel
            contactId={item.contactId}
            opportunityId={item.opportunityId ?? (item as any).openOpportunityId ?? null}
            title={item.opportunityTitle || item.contactName || "Selected CRM record"}
            contextPrompt={recommendationPrompt(toAiContext(item)!)}
            replyPrompt={replyPrompt(toAiContext(item)!)}
          />
        </View>
      )}
    </View>
  );
}

export default function AiWorkQueueScreen() {
  // This screen is shared by both AdminDrawer and AgentDrawer. Use whichever
  // drawer actually wraps this screen so the "Open" button can navigate for
  // agents too (the real provider omits `isDefault`).
  const adminDrawer = useContext(DrawerCtx);
  const agentDrawer = useContext(AgentDrawerCtx);
  const drawer = agentDrawer.isDefault ? adminDrawer : agentDrawer;
  const [activeTab, setActiveTab] = useState<"queue" | "inbox">("queue");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [leadInbox, setLeadInbox] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [taskCreating, setTaskCreating] = useState<string | number>("");
  // Dropdown state per "<tab>:<groupKey>". Groups start collapsed so the
  // screen shows a compact summary; the first group with items on each tab
  // auto-opens once so the view isn't just headers.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const autoOpenedTabsRef = React.useRef<Record<string, boolean>>({});

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const grouped = useMemo(() => {
    const byGroup = new Map<string, QueueItem[]>(GROUPS.map((g) => [g.key, []]));
    for (const item of items) {
      const key = byGroup.has(item.groupKey || "") ? item.groupKey! : "WATCH";
      byGroup.get(key)!.push(item);
    }
    return GROUPS.map((g) => ({ ...g, items: byGroup.get(g.key) || [] }));
  }, [items]);

  const inboxGrouped = useMemo(() => {
    const byGroup = new Map<string, QueueItem[]>(INBOX_GROUPS.map((g) => [g.key, []]));
    for (const item of leadInbox) {
      const key = byGroup.has(item.sectionKey || "") ? item.sectionKey! : "5_NURTURE";
      byGroup.get(key)!.push(item);
    }
    return INBOX_GROUPS.map((g) => ({ ...g, items: byGroup.get(g.key) || [] }));
  }, [leadInbox]);

  // Auto-open the first non-empty group per tab (once) after data arrives.
  useEffect(() => {
    const groups = activeTab === "queue" ? grouped : inboxGrouped;
    if (autoOpenedTabsRef.current[activeTab]) return;
    const firstPending = groups.find((g) => g.items.length > 0);
    if (!firstPending) return;
    autoOpenedTabsRef.current[activeTab] = true;
    setOpenGroups((prev) => ({ ...prev, [`${activeTab}:${firstPending.key}`]: true }));
  }, [activeTab, grouped, inboxGrouped]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await api.get("/api/ai/work-queue");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setMessage(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeadInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const res = await api.get("/api/ai/lead-inbox");
      setLeadInbox(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setMessage(errMsg(err));
    } finally {
      setInboxLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    loadLeadInbox();
  }, []);

  function openRecord(item: QueueItem) {
    // Web parity: navigate(item.targetPath || (opp ? /opportunities/:id
    // : /contacts)). Mobile has no deep routes, so map the targetPath to
    // the matching tab — task items go to Tasks (not Contacts), etc.
    const p = String(item.targetPath || "").toLowerCase();
    const tabFromPath =
      !p ? null :
      p.includes("task") ? "Tasks" :
      p.includes("opportunit") || p.includes("pipeline") ? "Pipeline" :
      p.includes("chat") || p.includes("inbox") ? "Chat" :
      p.includes("mail") || p.includes("email") ? "Mail" :
      p.includes("calendar") || p.includes("event") ? "Calendar" :
      p.includes("contact") ? "Contacts" : null;
    const hasOpp = item.opportunityId || item.openOpportunityId;
    drawer.navigateTo(tabFromPath ?? (hasOpp ? "Pipeline" : "Contacts"));
  }

  async function createTask(item: QueueItem) {
    if (!item.contactId) return;
    setTaskCreating(item.id);
    setMessage("");
    try {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(10, 0, 0, 0);
      await api.post(`/api/contacts/${item.contactId}/tasks`, {
        title: `Follow up: ${item.reasonLabel || item.sectionLabel || "AI Work Queue"}`,
        description: item.summary || "Follow up from AI Work Queue.",
        dueAt: dueAt.toISOString(),
      });
      setMessage("Follow-up task created for tomorrow at 10:00.");
    } catch (err: any) {
      setMessage(errMsg(err));
    } finally {
      setTaskCreating("");
    }
  }

  const urgentCount = items.filter((i) => i.groupKey === "URGENT").length;
  const hotCount = leadInbox.filter((i) => i.sectionKey === "1_HOT").length;
  const busy = loading || inboxLoading;

  const activeGroups = activeTab === "queue" ? grouped : inboxGrouped;
  const activeLoading = activeTab === "queue" ? loading : inboxLoading;
  const activeEmpty = activeTab === "queue" ? items.length === 0 : leadInbox.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadQueue(); loadLeadInbox(); }}
            tintColor="#0f766e"
          />
        }
      >
        {/* Slim header bar */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>AI Work Queue</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {urgentCount} urgent · {hotCount} hot leads
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, busy && { opacity: 0.5 }]}
            onPress={() => { loadQueue(); loadLeadInbox(); }}
            disabled={busy}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {([["queue", "Work Queue"], ["inbox", "Lead Inbox"]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!message && (
          <View style={styles.msgBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#92400e" />
            <Text style={styles.msgText}>{message}</Text>
          </View>
        )}

        {activeLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.emptyDesc}>
              {activeTab === "queue" ? "Finding the best CRM work to focus on…" : "Loading scored leads…"}
            </Text>
          </View>
        ) : activeEmpty ? (
          <View style={styles.emptyCard}>
            <Ionicons name={activeTab === "queue" ? "sparkles-outline" : "file-tray-outline"} size={34} color="#0f766e" />
            <Text style={styles.emptyTitle}>
              {activeTab === "queue" ? "No AI-priority work found" : "No scored leads yet"}
            </Text>
            <Text style={styles.emptyDesc}>
              {activeTab === "queue"
                ? "You are clear for now. Overdue tasks, stale deals, or high-score leads will appear here."
                : "Run AI lead scoring manually or from automation rules — scored leads will appear here."}
            </Text>
          </View>
        ) : (
          activeGroups.map((group) => {
            // Dropdown group: tap the header to expand/collapse so the queue
            // stays compact — only the group summaries take space by default.
            const open = !!openGroups[`${activeTab}:${group.key}`];
            return (
              <View key={group.key} style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.groupHeader, { backgroundColor: group.bg }]}
                  onPress={() => toggleGroup(`${activeTab}:${group.key}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={group.icon} size={16} color={group.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupLabel, { color: group.color }]}>{group.label}</Text>
                    <Text style={styles.groupHelper} numberOfLines={1}>{group.helper}</Text>
                  </View>
                  <Text style={[styles.groupCount, { color: group.color }]}>{group.items.length}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={group.color} />
                </TouchableOpacity>
                {open && group.items.length === 0 && (
                  <Text style={styles.groupEmptyText}>Nothing here right now.</Text>
                )}
                {open &&
                  group.items.map((item) => (
                    <QueueCard
                      key={String(item.id)}
                      item={item}
                      isInbox={activeTab === "inbox"}
                      selected={selectedId === item.id}
                      onSelect={(i) => setSelectedId(selectedId === i.id ? null : i.id)}
                      onOpen={openRecord}
                      onCreateTask={createTask}
                      taskCreating={taskCreating}
                    />
                  ))}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  scroll: { padding: 14, gap: 12 },

  headerBar: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: androidMedium,
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
  },
  headerSub: { color: "#ccfbf1", fontSize: 12, marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(118,118,128,0.08)",
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    fontFamily: androidMedium,
  },
  tabTextActive: { color: "#111827" },

  msgBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 11,
  },
  msgText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: "#92400e" },

  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: androidMedium,
  },
  groupHelper: { fontSize: 11.5, color: "#6b7280", marginTop: 1 },
  groupCount: { fontSize: 13, fontWeight: "700" },
  groupEmptyText: { fontSize: 12.5, color: "#9ca3af", textAlign: "center", paddingVertical: 6 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: { borderWidth: 1.5, borderColor: "#0f766e" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    fontFamily: androidMedium,
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
  },
  cardMeta: { fontSize: 12.5, color: "#6b7280", marginTop: 2 },
  cardSummary: { fontSize: 13, color: "#4b5563", lineHeight: 19, marginTop: 6 },
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timeText: { fontSize: 11.5, fontWeight: "600", color: "#6b7280" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0f766e",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiBtnText: { fontSize: 12.5, fontWeight: "600", color: "#fff", fontFamily: androidMedium },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(118,118,128,0.08)",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostBtnText: { fontSize: 12.5, fontWeight: "600", color: "#374151", fontFamily: androidMedium },

  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: androidMedium,
  },
  emptyDesc: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19 },
});
