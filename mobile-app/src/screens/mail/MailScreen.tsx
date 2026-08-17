import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
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
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import AiAssistPanel from "../../components/ai/AiAssistPanel";
import { useBadges } from "../../state/BadgeContext";

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

// Media asset from /api/media-assets — same shape the web's
// MediaLibraryDialog works with (publicUrl is what gets embedded).
interface MailAttachment {
  id: string | number;
  publicUrl: string;
  mediaType: string; // "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO"
  name: string;
}

const emptyComposer = {
  toEmail: "",
  subject: "",
  bodyText: "",
  attachments: [] as MailAttachment[],
};

// ── Web parity (Mail.jsx mediaHtmlSnippet/escapeHtml): media isn't sent as a
// multipart attachment — it's embedded in the email body as an <img> (images)
// or a link, using the asset's already-hosted publicUrl. ──
function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mediaHtmlSnippet(asset: MailAttachment): string {
  if (!asset.publicUrl) return "";
  const label = asset.name || "Media";
  if (asset.mediaType === "IMAGE") {
    return `<p><img src="${escapeHtml(asset.publicUrl)}" alt="${escapeHtml(label)}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
  }
  return `<p><a href="${escapeHtml(asset.publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
}

function attachmentIcon(mediaType: string): React.ComponentProps<typeof Ionicons>["name"] {
  if (mediaType === "IMAGE") return "image-outline";
  if (mediaType === "VIDEO") return "videocam-outline";
  if (mediaType === "AUDIO") return "musical-notes-outline";
  return "document-outline";
}

type FolderCounts = Record<Folder, number | null>;

const emptyCounts: FolderCounts = {
  ALL: null,
  INBOX: null,
  SENT: null,
  UNREAD: null,
  FAILED: null,
};

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

function formatCount(n: number | null): string {
  if (n === null) return "";
  if (n > 999) return `${Math.floor(n / 1000)}k+`;
  return String(n);
}

// ─── Media Library picker (mirrors web's MediaLibraryDialog for compose) ─────

function MailMediaPicker({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: MailAttachment) => void;
}) {
  const [assets, setAssets] = useState<MailAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError("");
    api
      .get("/api/media-assets")
      .then((r) => {
        const d = r.data ?? {};
        const items: any[] = Array.isArray(d) ? d : d.items ?? d.content ?? [];
        setAssets(
          items.map((a) => ({
            id: a.id,
            publicUrl: a.publicUrl || "",
            mediaType: a.mediaType || "DOCUMENT",
            name: a.name || a.originalFileName || "Untitled",
          }))
        );
      })
      .catch((err) => setError(err?.response?.data?.message || err?.message || "Failed to load media"))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Media Library</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator color="#0f766e" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.mediaPickerEmpty}>{error}</Text>
        ) : assets.length === 0 ? (
          <Text style={styles.mediaPickerEmpty}>
            No media assets yet. Upload from your device or from the web CRM's Media Library.
          </Text>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => String(a.id)}
            contentContainerStyle={{ padding: 14, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.mediaPickerRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
                {item.mediaType === "IMAGE" && item.publicUrl ? (
                  <Image
                    source={{ uri: item.publicUrl }}
                    style={styles.mediaPickerThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.mediaPickerThumb, styles.mediaPickerThumbPlaceholder]}>
                    <Ionicons name={attachmentIcon(item.mediaType)} size={22} color="#0f766e" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mediaPickerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.mediaPickerType}>{item.mediaType}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color="#0f766e" />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

interface ComposeModalProps {
  visible: boolean;
  saving: boolean;
  composer: typeof emptyComposer;
  onChange: (field: string, value: string) => void;
  onAttach: (asset: MailAttachment) => void;
  onRemoveAttachment: (id: MailAttachment["id"]) => void;
  onClose: () => void;
  onSend: () => void;
}

function ComposeModal({
  visible, saving, composer, onChange, onAttach, onRemoveAttachment, onClose, onSend,
}: ComposeModalProps) {
  const canSend = composer.toEmail.trim() && composer.subject.trim() && composer.bodyText.trim();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");

  // Upload a file from the phone to the CRM media library, then attach its
  // hosted publicUrl — same pipeline the chat's "Upload from Device" uses.
  async function uploadFromDevice() {
    if (uploading) return;
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    } catch {
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    setUploading(true);
    setAttachError("");
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
      const res = await api.post("/api/media-assets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const publicUrl: string = res.data?.publicUrl || res.data?.url || "";
      if (!publicUrl) throw new Error("Upload succeeded but no public URL returned.");
      const mimeType = file.mimeType || "";
      const mediaType = mimeType.startsWith("image/") ? "IMAGE"
        : mimeType.startsWith("video/") ? "VIDEO"
        : mimeType.startsWith("audio/") ? "AUDIO"
        : "DOCUMENT";
      onAttach({ id: res.data?.id ?? `up-${file.name}-${file.size ?? ""}`, publicUrl, mediaType, name: file.name });
    } catch (err: any) {
      setAttachError(err?.response?.data?.message || err?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

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

            {/* Attachments — embedded in the email body as image/link via the
                asset's hosted publicUrl (same as web's Insert media) */}
            <Text style={styles.inputLabel}>Attachments</Text>
            <View style={styles.attachBtnRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={() => setMediaPickerOpen(true)} activeOpacity={0.7}>
                <Ionicons name="images-outline" size={16} color="#0f766e" />
                <Text style={styles.attachBtnText}>Media Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={uploadFromDevice} disabled={uploading} activeOpacity={0.7}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#0f766e" />
                ) : (
                  <Ionicons name="folder-open-outline" size={16} color="#0f766e" />
                )}
                <Text style={styles.attachBtnText}>{uploading ? "Uploading…" : "Upload from Device"}</Text>
              </TouchableOpacity>
            </View>
            {!!attachError && <Text style={styles.attachError}>{attachError}</Text>}
            {composer.attachments.length > 0 && (
              <View style={styles.attachList}>
                {composer.attachments.map((a) => (
                  <View key={String(a.id)} style={styles.attachChip}>
                    {a.mediaType === "IMAGE" && a.publicUrl ? (
                      <Image source={{ uri: a.publicUrl }} style={styles.attachChipThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.attachChipThumb, styles.mediaPickerThumbPlaceholder]}>
                        <Ionicons name={attachmentIcon(a.mediaType)} size={15} color="#0f766e" />
                      </View>
                    )}
                    <Text style={styles.attachChipText} numberOfLines={1}>{a.name}</Text>
                    <TouchableOpacity onPress={() => onRemoveAttachment(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={styles.attachHint}>
                  Images appear inline in the email; other files are added as download links.
                </Text>
              </View>
            )}

            <AiAssistPanel
              title="AI Email Assistant"
              contextPrompt={
                `To: ${composer.toEmail}\nSubject: ${composer.subject}\n` +
                `Current draft:\n${composer.bodyText}\n\n` +
                `Draft a professional CRM follow-up email matching the subject and context above.`
              }
              replyPrompt={
                `To: ${composer.toEmail}\nSubject: ${composer.subject}\n` +
                `Draft:\n${composer.bodyText}\n\n` +
                `Write a clear, concise email body with one next-step CTA.`
              }
              onApply={(t) => onChange("bodyText", composer.bodyText ? composer.bodyText + "\n\n" + t : t)}
              applyLabel="Use in email"
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

          <MailMediaPicker
            visible={mediaPickerOpen}
            onClose={() => setMediaPickerOpen(false)}
            onSelect={(asset) => {
              setMediaPickerOpen(false);
              onAttach(asset);
            }}
          />
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
  const [counts, setCounts] = useState<FolderCounts>(emptyCounts);
  const isMountedRef = useRef(true);
  const badges = useBadges();

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

  // Fetch a lightweight count (totalElements) for every folder tab so badges
  // like Inbox (12) / Unread (3) / Failed (1) stay up to date.
  const fetchCounts = useCallback(async (currentSearch: string) => {
    try {
      const results = await Promise.allSettled(
        FOLDERS.map((f) =>
          api.get("/api/email/logs/page", {
            params: {
              folder: f.key,
              query: currentSearch.trim() || undefined,
              page: 0,
              size: 1,
            },
          })
        )
      );
      if (!isMountedRef.current) return;
      // Compute the new counts OUTSIDE the setState updater: React can run
      // updater functions during render, so calling badges.setMailCount from
      // inside one is a cross-component setState-in-render warning/bug.
      const updates: Partial<FolderCounts> = {};
      results.forEach((result, idx) => {
        const key = FOLDERS[idx].key;
        if (result.status === "fulfilled") {
          const data = result.value?.data || {};
          updates[key] = data.totalElements ?? 0;
        }
      });
      setCounts((prev) => ({ ...prev, ...updates }));
      // Bottom-tab badge mirrors the Unread folder count exactly
      if (updates.UNREAD !== undefined) {
        badges.setMailCount(Number(updates.UNREAD) || 0);
      }
    } catch {
      // Count badges are non-critical; fail silently.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setLoading(true);
      fetchEmails(0, true, folder, search);
      fetchCounts(search);
      return () => { isMountedRef.current = false; };
    }, [fetchEmails, fetchCounts, folder, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmails(0, true, folder, search);
    fetchCounts(search);
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
    fetchCounts(search);
  };

  const setComposerField = (field: string, value: string) => {
    setComposer((prev) => ({ ...prev, [field]: value }));
  };

  const addAttachment = (asset: MailAttachment) => {
    setComposer((prev) =>
      prev.attachments.some((a) => String(a.id) === String(asset.id))
        ? prev
        : { ...prev, attachments: [...prev.attachments, asset] }
    );
  };

  const removeAttachment = (id: MailAttachment["id"]) => {
    setComposer((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => String(a.id) !== String(id)),
    }));
  };

  const sendEmail = async () => {
    if (!composer.toEmail.trim() || !composer.subject.trim() || !composer.bodyText.trim()) return;
    setSaving(true);
    try {
      // Web parity: attachments ride inside the email body — images inline,
      // other files as links — using each asset's hosted publicUrl.
      const typed = composer.bodyText.trim();
      const attachmentTextLines = composer.attachments
        .map((a) => `${a.name}: ${a.publicUrl}`)
        .join("\n");
      const bodyText = [typed, attachmentTextLines].filter(Boolean).join("\n\n");
      const bodyHtml = composer.attachments.length
        ? `<p>${escapeHtml(typed).replaceAll("\n", "<br/>")}</p>` +
          composer.attachments.map(mediaHtmlSnippet).join("")
        : null;
      await api.post("/api/email/send", {
        toEmail: composer.toEmail.trim(),
        subject: composer.subject.trim(),
        bodyText,
        ...(bodyHtml ? { bodyHtml } : {}),
      });
      setComposer(emptyComposer);
      setComposeOpen(false);
      setSuccessMsg("Email sent.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchEmails(0, true, folder, search);
      fetchCounts(search);
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
    <SafeAreaView edges={[]} style={styles.container}>
      <ComposeModal
        visible={composeOpen}
        saving={saving}
        composer={composer}
        onChange={setComposerField}
        onAttach={addAttachment}
        onRemoveAttachment={removeAttachment}
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
      </View>

      {/* Folder tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {FOLDERS.map((f) => {
          const count = counts[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => selectFolder(f.key)}
              style={[styles.tab, folder === f.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, folder === f.key && styles.tabTextActive]}>{f.label}</Text>
              {count !== null && count !== undefined && (
                <View style={[styles.tabCountPill, folder === f.key && styles.tabCountPillActive]}>
                  <Text style={[styles.tabCountText, folder === f.key && styles.tabCountTextActive]}>
                    {formatCount(count)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
        contentContainerStyle={emails.length === 0 ? styles.emptyContainer : { paddingBottom: 96 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No emails found.</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#0f766e" /> : null}
        renderItem={({ item }) => {
          const isInbound = item.direction === "INBOUND";
          const unread = isInbound && !item.readAt;
          const contact = isInbound ? item.fromEmail : item.toEmail;

          const snippet = (item.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const avatarPalette = [
            { bg: "#fee2e2", fg: "#dc2626" },
            { bg: "#ffedd5", fg: "#ea580c" },
            { bg: "#fef3c7", fg: "#d97706" },
            { bg: "#dcfce7", fg: "#16a34a" },
            { bg: "#ccfbf1", fg: "#0f766e" },
            { bg: "#dbeafe", fg: "#2563eb" },
            { bg: "#ede9fe", fg: "#7c3aed" },
            { bg: "#fce7f3", fg: "#db2777" },
          ];
          const hue = avatarPalette[(contact || "?").charCodeAt(0) % avatarPalette.length];

          return (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => navigation?.navigate("MailDetail", { emailId: item.id })}
            >
              <View style={[styles.card, unread && styles.cardUnread]}>
                <View style={styles.cardRow}>
                  {/* Gmail-style colored letter avatar */}
                  <View style={[styles.avatar, { backgroundColor: hue.bg }]}>
                    <Text style={[styles.avatarText, { color: hue.fg }]}>
                      {initials(contact)[0] ?? "?"}
                    </Text>
                  </View>

                  {/* Content */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <Text
                        style={[styles.contactText, unread ? styles.contactUnread : styles.contactRead]}
                        numberOfLines={1}
                      >
                        {contact || (isInbound ? "Unknown sender" : "Unknown recipient")}
                      </Text>
                      <Text style={[styles.dateText, unread && styles.dateUnread]}>
                        {shortDate(item.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.subjectText, unread ? styles.subjectUnread : styles.subjectRead]}
                      numberOfLines={1}
                    >
                      {item.subject || "(No subject)"}
                    </Text>
                    {(!!snippet || item.status === "FAILED" || !isInbound) && (
                      <View style={styles.snippetRow}>
                        <Text style={styles.snippetText} numberOfLines={1}>
                          {snippet || (isInbound ? "" : "You sent this email")}
                        </Text>
                        {item.status === "FAILED" && (
                          <View style={styles.failedBadge}>
                            <Text style={styles.failedBadgeText}>Failed</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Gmail-style compose FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setComposeOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="pencil" size={20} color="#0f766e" />
        <Text style={styles.fabLabel}>Compose</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Search + compose
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10 },
  searchInput: {
    flex: 1, height: 38, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15, letterSpacing: Platform.OS === "ios" ? -0.24 : 0, color: "#111827",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f766e",
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },

  // Folder tabs
  tabsScroll: { flexGrow: 0 },
  tabs: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: "row" },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99, backgroundColor: "rgba(118,118,128,0.08)" },
  tabActive: { backgroundColor: "#0f766e" },
  tabText: {
    fontSize: 13, fontWeight: "600", color: "#4b5563",
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  tabTextActive: { color: "#fff" },
  tabCountPill: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(60,60,67,0.12)", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabCountPillActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabCountText: { fontSize: 11, fontWeight: "700", color: "#4b5563" },
  tabCountTextActive: { color: "#fff" },

  // Count
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6 },
  countText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },

  // List
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#9ca3af", marginTop: 40 },

  // Row (native list style — full-bleed rows with hairline separators)
  card: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  cardUnread: { backgroundColor: "#fff" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: {
    fontSize: 17, fontWeight: "600",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  cardContent: { flex: 1 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  cardTopLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 },
  contactText: {
    fontSize: 15, flex: 1, marginRight: 8,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  contactUnread: {
    color: "#111827", fontWeight: "700",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  contactRead: { color: "#4b5563", fontWeight: "400" },
  dateText: { fontSize: 11.5, color: "#6b7280", flexShrink: 0 },
  dateUnread: { color: "#0f766e", fontWeight: "700" },
  subjectText: {
    fontSize: 13.5, lineHeight: 18, marginBottom: 1,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  subjectUnread: {
    color: "#111827", fontWeight: "600",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  subjectRead: { color: "#4b5563", fontWeight: "400" },
  snippetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  snippetText: { flex: 1, fontSize: 13, color: "#9ca3af", lineHeight: 18 },
  failedBadge: { backgroundColor: "#fee2e2", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  failedBadgeText: { fontSize: 11, fontWeight: "700", color: "#dc2626" },

  // Banners
  successBanner: { backgroundColor: "#d1fae5", paddingHorizontal: 16, paddingVertical: 10 },
  successText: { fontSize: 13, color: "#065f46", fontWeight: "600" },

  // Modal
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  attachBtnRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  attachBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(15,118,110,0.08)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, flex: 1,
  },
  attachBtnText: { fontSize: 12.5, fontWeight: "600", color: "#0f766e" },
  attachError: { fontSize: 12, color: "#dc2626", marginBottom: 8 },
  attachList: { gap: 6, marginBottom: 8 },
  attachChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(118,118,128,0.06)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  attachChipText: { flex: 1, fontSize: 12.5, color: "#111827", fontWeight: "500" },
  attachHint: { fontSize: 11, color: "#9ca3af", lineHeight: 15 },
  mediaPickerEmpty: {
    color: "#94a3b8", textAlign: "center", marginTop: 40,
    paddingHorizontal: 24, fontSize: 13.5, lineHeight: 20,
  },
  mediaPickerRow: {
    flexDirection: "row", alignItems: "center", gap: 11,
    backgroundColor: "#fff", borderRadius: 12, padding: 11,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  mediaPickerThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#f1f5f9" },
  mediaPickerThumbPlaceholder: {
    backgroundColor: "rgba(15,118,110,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  attachChipThumb: { width: 34, height: 34, borderRadius: 6, backgroundColor: "#f1f5f9" },
  mediaPickerName: { fontSize: 13.5, fontWeight: "600", color: "#0f172a" },
  mediaPickerType: { fontSize: 11, color: "#0f766e", fontWeight: "600", marginTop: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.15)",
  },
  modalTitle: {
    fontSize: 17, fontWeight: "600", color: "#111827",
    letterSpacing: Platform.OS === "ios" ? -0.4 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  modalClose: { padding: 6 },
  modalCloseText: { fontSize: 17, color: "#6b7280" },
  modalBody: { padding: 20, gap: 6 },
  inputLabel: {
    fontSize: 13, fontWeight: "600", color: "#6b7280",
    marginBottom: 6, marginTop: 12,
    letterSpacing: Platform.OS === "ios" ? -0.08 : 0.2,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  input: {
    backgroundColor: "rgba(118,118,128,0.06)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 16, letterSpacing: Platform.OS === "ios" ? -0.32 : 0, color: "#111827",
  },
  textarea: { minHeight: 170, paddingTop: 12, lineHeight: 22 },
  modalFooter: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.15)",
  },
  btnPrimary: {
    flex: 1, backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 14, alignItems: "center",
    shadowColor: "#0f766e", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  btnPrimaryText: {
    color: "#fff", fontWeight: "600", fontSize: 16,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  btnSecondary: { flex: 1, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: {
    color: "#374151", fontWeight: "600", fontSize: 16,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  btnDisabled: { opacity: 0.5 },
});
