import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: number;
  direction: "INBOUND" | "OUTBOUND";
  subject: string;
  fromEmail: string;
  toEmail: string;
  status: string;
  body?: string;
  readAt?: string | null;
  createdAt: string;
  contactId?: number | null;
  opportunityId?: number | null;
}

interface PageInfo {
  page: number;
  totalPages: number;
  totalElements: number;
}

type Folder = "ALL" | "INBOX" | "SENT" | "UNREAD" | "FAILED";

const FOLDERS: { key: Folder; label: string }[] = [
  { key: "ALL",    label: "All Mail" },
  { key: "INBOX",  label: "Inbox"    },
  { key: "SENT",   label: "Sent"     },
  { key: "UNREAD", label: "Unread"   },
  { key: "FAILED", label: "Failed"   },
];

const PAGE_SIZE = 20;

const emptyComposer = { toEmail: "", subject: "", bodyText: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  ) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(email: string) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

interface ComposeModalProps {
  visible: boolean;
  saving: boolean;
  composer: typeof emptyComposer;
  onChange: (field: string, value: string) => void;
  onClose: () => void;
  onSend: () => void;
}

function ComposeModal({ visible, saving, composer, onChange, onClose, onSend }: ComposeModalProps) {
  const canSend = composer.toEmail.trim() && composer.subject.trim() && composer.bodyText.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Compose Email</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>To</Text>
            <TextInput
              style={styles.input}
              value={composer.toEmail}
              onChangeText={(v) => onChange("toEmail", v)}
              placeholder="recipient@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={composer.subject}
              onChangeText={(v) => onChange("subject", v)}
              placeholder="Subject"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={composer.bodyText}
              onChangeText={(v) => onChange("bodyText", v)}
              placeholder="Write your message..."
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={onClose} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSend}
              disabled={saving || !canSend}
              style={[styles.btnPrimary, (!canSend || saving) && styles.btnDisabled]}
            >
              <Text style={styles.btnPrimaryText}>{saving ? "Sending..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MailScreen({ navigation }: any) {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 0, totalPages: 1, totalElements: 0 });
  const [folder, setFolder] = useState<Folder>("INBOX");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composer, setComposer] = useState(emptyComposer);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const isMountedRef = useRef(true);

  const fetchEmails = useCallback(async (pageNum: number, replace: boolean, currentFolder: Folder, currentSearch: string) => {
    try {
      if (pageNum === 0) setError(null);
      const res = await api.get("/api/email/logs/page", {
        params: {
          folder: currentFolder,
          query: currentSearch.trim() || undefined,
          page: pageNum,
          size: PAGE_SIZE,
        },
      });
      if (!isMountedRef.current) return;
      const data = res?.data || {};
      const items: EmailLog[] = Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setEmails((prev) => replace ? items : [...prev, ...items]);
      setPageInfo({
        page: pageNum,
        totalPages: data.totalPages ?? 1,
        totalElements: data.totalElements ?? items.length,
      });
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setError(e?.message || "Failed to load emails");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setLoading(true);
      fetchEmails(0, true, folder, search);
      return () => { isMountedRef.current = false; };
    }, [fetchEmails, folder, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmails(0, true, folder, search);
  };

  const loadMore = () => {
    if (loadingMore || pageInfo.page >= pageInfo.totalPages - 1) return;
    setLoadingMore(true);
    fetchEmails(pageInfo.page + 1, false, folder, search);
  };

  const selectFolder = (f: Folder) => {
    if (f === folder) return;
    setFolder(f);
    setEmails([]);
    setLoading(true);
    fetchEmails(0, true, f, search);
  };

  const onSearchSubmit = () => {
    setEmails([]);
    setLoading(true);
    fetchEmails(0, true, folder, search);
  };

  const setComposerField = (field: string, value: string) => {
    setComposer((prev) => ({ ...prev, [field]: value }));
  };

  const sendEmail = async () => {
    if (!composer.toEmail.trim() || !composer.subject.trim() || !composer.bodyText.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/email/send", {
        toEmail: composer.toEmail.trim(),
        subject: composer.subject.trim(),
        bodyText: composer.bodyText.trim(),
      });
      setComposer(emptyComposer);
      setComposeOpen(false);
      setSuccessMsg("Email sent.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEmails(0, true, folder, search);
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading && emails.length === 0) return <LoadingSpinner message="Loading emails..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <ComposeModal
        visible={composeOpen}
        saving={saving}
        composer={composer}
        onChange={setComposerField}
        onClose={() => setComposeOpen(false)}
        onSend={sendEmail}
      />

      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchEmails(0, true, folder, search); }} />}
      {!!successMsg && <View style={styles.successBanner}><Text style={styles.successText}>{successMsg}</Text></View>}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          placeholder="Search mail..."
          placeholderTextColor="#94a3b8"
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setComposeOpen(true)} style={styles.composeBtn}>
          <Text style={styles.composeBtnText}>Compose</Text>
        </TouchableOpacity>
      </View>

      {/* Folder tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {FOLDERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => selectFolder(f.key)}
            style={[styles.tab, folder === f.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, folder === f.key && styles.tabTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{pageInfo.totalElements} messages</Text>
        {loading && <ActivityIndicator size="small" color="#0f766e" />}
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}   // ✅ ADD THIS

        data={emails}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={emails.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No emails found.</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#0f766e" /> : null}
        renderItem={({ item }) => {
          const isInbound = item.direction === "INBOUND";
          const unread = isInbound && !item.readAt;
          const contact = isInbound ? item.fromEmail : item.toEmail;

          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation?.navigate("MailDetail", { emailId: item.id })}
            >
              <View style={[styles.card, unread && styles.cardUnread]}>
                <View style={styles.cardRow}>
                  {/* Avatar */}
                  <View style={[styles.avatar, { backgroundColor: isInbound ? "#dbeafe" : "#d1fae5" }]}>
                    <Text style={[styles.avatarText, { color: isInbound ? "#3b82f6" : "#0f766e" }]}>
                      {initials(contact)}
                    </Text>
                  </View>

                  {/* Content */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTopLeft}>
                        {unread && <View style={styles.unreadDot} />}
                        <Text style={[styles.contactText, unread && styles.bold]} numberOfLines={1}>
                          {contact || (isInbound ? "Unknown sender" : "Unknown recipient")}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>{shortDate(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.subjectText, unread && styles.bold]} numberOfLines={1}>
                      {item.subject || "(No subject)"}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: isInbound ? "#dbeafe" : "#ccfbf1" }]}>
                        <Text style={[styles.badgeText, { color: isInbound ? "#3b82f6" : "#0f766e" }]}>
                          {isInbound ? "Inbox" : "Sent"}
                        </Text>
                      </View>
                      {item.status === "FAILED" && (
                        <View style={[styles.badge, { backgroundColor: "#fee2e2", marginLeft: 6 }]}>
                          <Text style={[styles.badgeText, { color: "#ef4444" }]}>Failed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  // Search + compose
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchInput: {
    flex: 1, height: 40, backgroundColor: "#fff", borderRadius: 20,
    borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 16,
    fontSize: 14, color: "#1e293b",
  },
  composeBtn: { backgroundColor: "#0f766e", borderRadius: 20, paddingHorizontal: 16, height: 40, justifyContent: "center" },
  composeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Folder tabs
  tabsScroll: { flexGrow: 0 },
tabs: { paddingHorizontal: 12, paddingVertical: 7, gap: 8, flexDirection: "row" },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#e2e8f0"},
  tabActive: { backgroundColor: "#0f766e" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  tabTextActive: { color: "#fff" },

  // Count
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6 },
  countText: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },

  // List
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#94a3b8", marginTop: 40 },

  // Card
  card: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#0f766e" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "800" },
  cardContent: { flex: 1 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#0f766e" },
  contactText: { fontSize: 13, color: "#475569", flex: 1 },
  dateText: { fontSize: 11, color: "#94a3b8", flexShrink: 0 },
  subjectText: { fontSize: 14, color: "#1e293b", marginBottom: 6 },
  bold: { fontWeight: "700" },
  badgeRow: { flexDirection: "row", alignItems: "center" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Banners
  successBanner: { backgroundColor: "#d1fae5", paddingHorizontal: 16, paddingVertical: 10 },
  successText: { fontSize: 13, color: "#065f46", fontWeight: "600" },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalClose: { padding: 6 },
  modalCloseText: { fontSize: 16, color: "#64748b" },
  modalBody: { padding: 20, gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1e293b" },
  textarea: { minHeight: 160, paddingTop: 12 },
  modalFooter: { flexDirection: "row", gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  btnPrimary: { flex: 1, backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  btnSecondaryText: { color: "#475569", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});