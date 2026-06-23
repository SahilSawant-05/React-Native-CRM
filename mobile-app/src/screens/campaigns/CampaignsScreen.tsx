import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: string | number;
  name: string;
  metaTemplateName?: string;
  category?: string;
  status?: string;
  body?: string;
}

interface Contact {
  id: string | number;
  name: string;
  phone?: string;
  email?: string;
}

interface Campaign {
  id: string | number;
  name: string;
  templateName?: string;
  metaTemplateName?: string;
  status: string;
  recipientCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  scheduledAt?: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SENT:      { bg: "#dcfce7", text: "#22c55e" },
  SENDING:   { bg: "#dbeafe", text: "#3b82f6" },
  SCHEDULED: { bg: "#fef3c7", text: "#f59e0b" },
  FAILED:    { bg: "#fee2e2", text: "#ef4444" },
  PAUSED:    { bg: "#f1f5f9", text: "#64748b" },
  CANCELLED: { bg: "#f1f5f9", text: "#94a3b8" },
};

// ─── Contact Picker Modal (with server-side search + pagination) ──────────────

function ContactPickerModal({
  visible, onClose, selected, onToggle,
}: {
  visible: boolean; onClose: () => void;
  selected: Set<string | number>; onToggle: (id: string | number) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimerRef = React.useRef<any>(null);

  const fetchContacts = useCallback(async (q: string, p: number, replace: boolean) => {
    try {
      if (replace) setLoading(true); else setLoadingMore(true);
      const endpoint = q.trim()
        ? `/api/contacts/search/page`
        : `/api/contacts/page`;
      const res = await api.get(endpoint, { params: { page: p, size: 20, query: q.trim() || undefined } });
      const data = res.data ?? {};
      const items: Contact[] = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : Array.isArray(data.items) ? data.items : [];
      setContacts(prev => replace ? items : [...prev, ...items]);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load on open
  useEffect(() => {
    if (visible) { setSearch(""); setPage(0); fetchContacts("", 0, true); }
  }, [visible]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(0);
      fetchContacts(search, 0, true);
    }, 400);
  }, [search]);

  const loadMore = () => {
    if (!loadingMore && page + 1 < totalPages) fetchContacts(search, page + 1, false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={mpStyles.header}>
          <Text style={mpStyles.title}>Recipients ({selected.size} selected)</Text>
          <TouchableOpacity onPress={onClose} style={mpStyles.doneBtn}>
            <Text style={mpStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={mpStyles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone..."
          placeholderTextColor="#94a3b8"
        />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0f766e" />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <ActivityIndicator color="#0f766e" style={{ margin: 12 }} /> : null}
            ListEmptyComponent={<Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>No contacts found</Text>}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity onPress={() => onToggle(item.id)} style={mpStyles.row} activeOpacity={0.7}>
                  <View style={[mpStyles.check, isSelected && mpStyles.checkSelected]}>
                    {isSelected && <Text style={mpStyles.checkMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={mpStyles.name}>{item.name}</Text>
                    {!!item.phone && <Text style={mpStyles.meta}>{item.phone}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const mpStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  doneBtn: { backgroundColor: "#0f766e", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700" },
  search: { margin: 16, backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1e293b" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  checkSelected: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
});

// ─── Create Tab ───────────────────────────────────────────────────────────────

function CreateTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string | number>>(new Set());
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const tRes = await api.get("/api/templates");
        setTemplates(normalize(tRes.data));
      } catch (e: any) {
        setError(e?.message || "Failed to load templates");
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, []);

  const toggleContact = (id: string | number) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!name.trim() || !selectedTemplate || selectedContacts.size === 0) {
      setError("Please fill in campaign name, select a template and at least one recipient.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post("/api/campaigns", {
        name: name.trim(),
        templateId: selectedTemplate.id,
        contactIds: Array.from(selectedContacts),
        sendNow,
        scheduledAt: !sendNow && scheduledAt ? scheduledAt : undefined,
      });
      setName("");
      setSelectedTemplate(null);
      setSelectedContacts(new Set());
      setScheduledAt("");
      setSuccessMsg("Campaign created successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to create campaign");
    } finally {
      setSending(false);
    }
  };

  if (loadingData) return <LoadingSpinner message="Loading..." />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={ctStyles.scroll} keyboardShouldPersistTaps="handled">
        {!!error && <View style={ctStyles.errorBanner}><Text style={ctStyles.errorText}>{error}</Text></View>}
        {!!successMsg && <View style={ctStyles.successBanner}><Text style={ctStyles.successText}>{successMsg}</Text></View>}

        <Text style={ctStyles.label}>Campaign Name</Text>
        <TextInput
          style={ctStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Summer Promo"
          placeholderTextColor="#94a3b8"
        />

        <Text style={ctStyles.label}>Template</Text>
        <TouchableOpacity style={ctStyles.picker} onPress={() => setTemplatePickerOpen(true)}>
          <Text style={selectedTemplate ? ctStyles.pickerValue : ctStyles.pickerPlaceholder}>
            {selectedTemplate ? (selectedTemplate.metaTemplateName || selectedTemplate.name) : "Select template..."}
          </Text>
          <Text style={ctStyles.pickerChevron}>▾</Text>
        </TouchableOpacity>

        <Text style={ctStyles.label}>Recipients ({selectedContacts.size} selected)</Text>
        <TouchableOpacity style={ctStyles.picker} onPress={() => setPickerOpen(true)}>
          <Text style={selectedContacts.size > 0 ? ctStyles.pickerValue : ctStyles.pickerPlaceholder}>
            {selectedContacts.size > 0 ? `${selectedContacts.size} contact(s) selected` : "Select contacts..."}
          </Text>
          <Text style={ctStyles.pickerChevron}>▾</Text>
        </TouchableOpacity>

        <Text style={ctStyles.label}>Schedule</Text>
        <View style={ctStyles.toggleRow}>
          <TouchableOpacity
            style={[ctStyles.toggleBtn, sendNow && ctStyles.toggleBtnActive]}
            onPress={() => setSendNow(true)}
          >
            <Text style={[ctStyles.toggleText, sendNow && ctStyles.toggleTextActive]}>Send Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ctStyles.toggleBtn, !sendNow && ctStyles.toggleBtnActive]}
            onPress={() => setSendNow(false)}
          >
            <Text style={[ctStyles.toggleText, !sendNow && ctStyles.toggleTextActive]}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {!sendNow && (
          <>
            <Text style={ctStyles.label}>Scheduled At (ISO date)</Text>
            <TextInput
              style={ctStyles.input}
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="e.g. 2025-01-15T10:00:00"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </>
        )}

        <TouchableOpacity
          onPress={send}
          disabled={sending}
          style={[ctStyles.sendBtn, sending && ctStyles.sendBtnDisabled]}
        >
          <Text style={ctStyles.sendBtnText}>
            {sending ? "Creating..." : sendNow ? "🚀 Launch Campaign" : "📅 Schedule Campaign"}
          </Text>
        </TouchableOpacity>

        {/* Template picker modal */}
        <Modal visible={templatePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTemplatePickerOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <View style={mpStyles.header}>
              <Text style={mpStyles.title}>Select Template</Text>
              <TouchableOpacity onPress={() => setTemplatePickerOpen(false)} style={mpStyles.doneBtn}>
                <Text style={mpStyles.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={templates}
              keyExtractor={(t) => String(t.id)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>No templates found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[ctStyles.templateRow, selectedTemplate?.id === item.id && ctStyles.templateRowSelected]}
                  onPress={() => { setSelectedTemplate(item); setTemplatePickerOpen(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={ctStyles.templateName}>{item.metaTemplateName || item.name}</Text>
                    {!!item.category && <Text style={ctStyles.templateMeta}>{item.category}</Text>}
                    {!!item.body && <Text style={ctStyles.templateBody} numberOfLines={2}>{item.body}</Text>}
                  </View>
                  {selectedTemplate?.id === item.id && <Text style={{ color: "#0f766e", fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

        <ContactPickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selected={selectedContacts}
          onToggle={toggleContact}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ctStyles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#1e293b" },
  picker: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerValue: { fontSize: 14, color: "#1e293b", flex: 1 },
  pickerPlaceholder: { fontSize: 14, color: "#94a3b8", flex: 1 },
  pickerChevron: { fontSize: 14, color: "#94a3b8" },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", backgroundColor: "#fff" },
  toggleBtnActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  toggleTextActive: { color: "#fff" },
  sendBtn: { marginTop: 24, backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  errorBanner: { backgroundColor: "#fee2e2", borderRadius: 10, padding: 12, marginBottom: 4 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  successBanner: { backgroundColor: "#d1fae5", borderRadius: 10, padding: 12, marginBottom: 4 },
  successText: { fontSize: 13, color: "#065f46", fontWeight: "600" },
  templateRow: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", alignItems: "center", gap: 12 },
  templateRowSelected: { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  templateName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  templateMeta: { fontSize: 12, color: "#0f766e", marginTop: 2 },
  templateBody: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 17 },
});

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/campaigns/history/page?page=0&size=30");
      const items = normalize(res.data);
      setCampaigns(items.length ? items : normalize(await api.get("/api/campaigns?page=0&size=30").then(r => r.data)));
    } catch (e: any) {
      try {
        const res2 = await api.get("/api/campaigns?page=0&size=30");
        setCampaigns(normalize(res2.data));
      } catch (e2: any) {
        setError(e2?.message || "Failed to load campaigns");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  if (loading) return <LoadingSpinner message="Loading campaigns..." />;

  return (
    <FlatList
      data={campaigns}
      keyExtractor={(item) => String(item.id)}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); fetch(); }}
      contentContainerStyle={campaigns.length === 0 ? { flex: 1, justifyContent: "center", alignItems: "center" } : { padding: 16 }}
      ListHeaderComponent={error ? <View style={{ backgroundColor: "#fee2e2", borderRadius: 10, padding: 12, marginBottom: 10 }}><Text style={{ color: "#b91c1c", fontSize: 13 }}>{error}</Text></View> : null}
      ListEmptyComponent={<Text style={{ fontSize: 15, color: "#94a3b8", marginTop: 40 }}>No campaigns yet</Text>}
      renderItem={({ item }) => {
        const st = STATUS_COLORS[item.status] || STATUS_COLORS.SCHEDULED;
        const total = item.recipientCount ?? 0;
        const sent = item.sentCount ?? 0;
        const delivered = item.deliveredCount ?? 0;
        const failed = item.failedCount ?? 0;
        const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

        return (
          <View style={htStyles.card}>
            <View style={htStyles.row}>
              <Text style={htStyles.name} numberOfLines={1}>{item.name}</Text>
              <View style={[htStyles.badge, { backgroundColor: st.bg }]}>
                <Text style={[htStyles.badgeText, { color: st.text }]}>{item.status}</Text>
              </View>
            </View>
            {!!(item.templateName || item.metaTemplateName) && (
              <Text style={htStyles.template}>📝 {item.templateName || item.metaTemplateName}</Text>
            )}
            {total > 0 && (
              <View style={htStyles.statsRow}>
                <Text style={htStyles.stat}>👥 {total}</Text>
                <Text style={htStyles.stat}>✉️ {sent}</Text>
                <Text style={htStyles.stat}>✅ {delivered}</Text>
                {failed > 0 && <Text style={[htStyles.stat, { color: "#ef4444" }]}>❌ {failed}</Text>}
                <Text style={[htStyles.stat, { color: "#0f766e", fontWeight: "700" }]}>{pct}%</Text>
              </View>
            )}
            <Text style={htStyles.date}>{formatDate(item.scheduledAt || item.createdAt)}</Text>
          </View>
        );
      }}
    />
  );
}

const htStyles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  template: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 6 },
  stat: { fontSize: 12, color: "#64748b" },
  date: { fontSize: 11, color: "#94a3b8" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CampaignsScreen() {
  const [tab, setTab] = useState<"create" | "history">("create");

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "create" && styles.tabActive]}
          onPress={() => setTab("create")}
        >
          <Text style={[styles.tabText, tab === "create" && styles.tabTextActive]}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "history" && styles.tabActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {tab === "create" ? <CreateTab /> : <HistoryTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#0f766e" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  tabTextActive: { color: "#0f766e" },
});
