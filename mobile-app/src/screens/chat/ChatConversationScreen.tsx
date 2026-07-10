import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { fetchMessages, markAsRead, sendTextMessage, Message, InboxItem } from "../../api/chat";
import api from "../../api/client";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import AiAssistPanel from "../../components/ai/AiAssistPanel";
import { useBadges } from "../../state/BadgeContext";

type Props = {
  route: RouteProp<{ ChatConversation: { inbox: InboxItem } }, "ChatConversation">;
  navigation?: any;
};

interface Template {
  id: string | number;
  name?: string;
  metaTemplateName?: string;
  category?: string;
  body?: string;
  status?: string;
  componentsJson?: string; // JSON array of WhatsApp template components (matches web field name)
}

function parseTemplateComponents(template: Template): any[] {
  try {
    const parsed = JSON.parse(template?.componentsJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Returns "IMAGE" | "VIDEO" | "DOCUMENT" | "" depending on the template's HEADER component
function templateHeaderMediaFormat(template: Template): string {
  const header = parseTemplateComponents(template).find(
    (c: any) => String(c?.type || "").toUpperCase() === "HEADER"
  );
  const format = String(header?.format || "").toUpperCase();
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(format) ? format : "";
}

// Media asset returned by the /api/media-assets endpoint (same shape the web app uses)
interface MediaAsset {
  id: string | number;
  publicUrl: string;
  mediaType: string;        // "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO"
  originalFileName?: string;
  name?: string;
  createdAt?: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(new Date(dateStr));
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(dateStr));
}

// Returns a reliable epoch ms for a message regardless of which timestamp
// field the API populated (createdAt vs timestamp), used for sorting.
function messageTime(m?: Message): number {
  if (!m) return 0;
  const raw = m.createdAt || m.timestamp;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

// A best-effort content signature used to recognise when an optimistic
// (temp-) message we appended locally has come back from the server with a
// real id, so we can drop the temp duplicate instead of showing both.
function messageSignature(m: Message): string {
  const body = (m.textBody || m.body || m.text || "").trim();
  return `${m.direction}|${body}|${m.mediaUrl || ""}`;
}

function realId(m: Message): string | null {
  const id = m.id ?? m.messageId;
  return id != null && !String(id).startsWith("temp-") ? String(id) : null;
}

// True when two message objects represent the same message with the same
// visible content (status, text, media). Used to decide whether a freshly
// re-fetched copy of a message actually needs to replace the one already
// on screen, or whether we can just keep the existing object reference —
// which lets React (and <Image>) skip re-rendering/re-decoding a bubble
// that hasn't really changed.
function messagesEqual(a: Message, b: Message): boolean {
  return (
    (a.status ?? "") === (b.status ?? "") &&
    (a.textBody || a.body || a.text || "") === (b.textBody || b.body || b.text || "") &&
    (a.mediaUrl ?? "") === (b.mediaUrl ?? "") &&
    (a.mediaType ?? "") === (b.mediaType ?? "") &&
    (a.mediaFileName ?? "") === (b.mediaFileName ?? "") &&
    (a.createdAt || a.timestamp || "") === (b.createdAt || b.timestamp || "")
  );
}

// Merge freshly-fetched page-0 messages into whatever is already on screen
// (optimistic sends + previously loaded pages) without dropping older pages
// or double-showing a message. Keyed by real id/messageId; temp- optimistic
// messages are removed once a matching server message exists.
//
// Object identity is preserved wherever content hasn't actually changed —
// both per-message (so an unchanged bubble/image never re-renders) and for
// the whole array (so a no-op poll returns the exact same array reference,
// letting React's setState bail out and skip re-rendering entirely). This
// is what keeps background polling invisible instead of visibly jittering
// the thread every few seconds.
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const existingByRid = new Map<string, Message>();
  for (const m of existing) {
    const rid = realId(m);
    if (rid) existingByRid.set(rid, m);
  }

  const byKey = new Map<string, Message>();
  const realSignatures = new Set<string>();

  // Server messages win — index them first, reusing the existing object
  // reference whenever the incoming copy is content-identical.
  for (const m of incoming) {
    const rid = realId(m);
    if (rid) {
      const prevVersion = existingByRid.get(rid);
      byKey.set(rid, prevVersion && messagesEqual(prevVersion, m) ? prevVersion : m);
      realSignatures.add(messageSignature(m));
    } else {
      byKey.set(messageSignature(m) + "|" + messageTime(m), m);
    }
  }

  for (const m of existing) {
    const rid = realId(m);
    if (rid) {
      if (!byKey.has(rid)) byKey.set(rid, m);
      continue;
    }
    // Optimistic temp message: drop it if the server already returned an
    // equivalent one, otherwise keep it until the next poll confirms it.
    if (realSignatures.has(messageSignature(m))) continue;
    byKey.set(messageSignature(m) + "|" + messageTime(m), m);
  }

  // Sort newest-first. Tie-break on the map key (which encodes the real id,
  // or a signature+time for optimistic ones) so that two messages sharing
  // the exact same timestamp always land in the same relative order on
  // every merge — otherwise a tie could flip randomly between polls
  // (depending on the order the API happened to return them in that call)
  // and make the thread look like it's reshuffling itself on refresh.
  const merged = Array.from(byKey.entries())
    .sort(([keyA, a], [keyB, b]) => {
      const dt = messageTime(b) - messageTime(a);
      if (dt !== 0) return dt;
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    })
    .map(([, m]) => m);

  // Nothing actually changed — hand back the SAME array reference so the
  // caller's setState is a no-op and nothing re-renders.
  if (merged.length === existing.length && merged.every((m, i) => m === existing[i])) {
    return existing;
  }
  return merged;
}

function StatusTick({ status }: { status?: string }) {
  const s = (status ?? "").toUpperCase();
  if (s === "FAILED") return <Ionicons name="alert-circle" size={14} color="#dc2626" style={styles.statusIcon} />;
  if (s === "SENDING") return <Ionicons name="time-outline" size={14} color="#8696a0" style={styles.statusIcon} />;
  if (s === "READ") return <Ionicons name="checkmark-done" size={15} color="#53bdeb" style={styles.statusIcon} />;
  if (s === "DELIVERED") return <Ionicons name="checkmark-done" size={15} color="#8696a0" style={styles.statusIcon} />;
  return <Ionicons name="checkmark" size={15} color="#8696a0" style={styles.statusIcon} />;
}

function MediaBubble({ message, isOut }: { message: Message; isOut: boolean }) {
  const mt = (message.mediaType ?? "").toUpperCase();
  const url = message.mediaUrl;
  if (!url) return null;

  if (mt === "IMAGE" || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
    return (
      <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
    );
  }
  const iconName = mt === "VIDEO" ? "videocam" : mt === "AUDIO" ? "musical-notes" : "document-text";
  return (
    <View style={styles.mediaFile}>
      <Ionicons name={iconName as any} size={22} color={isOut ? "#3b4a54" : "#54656f"} />
      <Text
        style={[styles.mediaFileName, isOut && { color: "#3b4a54" }]}
        numberOfLines={1}
      >
        {message.mediaFileName || "Attachment"}
      </Text>
    </View>
  );
}

const MessageBubble = React.memo(
  function MessageBubble({
    message,
    prevMessage,
    onRetry,
  }: {
    message: Message;
    prevMessage?: Message;
    onRetry?: (m: Message) => void;
  }) {
    const isOut = message.direction === "OUTBOUND";
    const text = message.textBody || message.body || message.text || "";
    const time = message.createdAt || message.timestamp;
    const failed = (message.status ?? "").toUpperCase() === "FAILED";

    // In an inverted list prevMessage is the older message just above this one.
    // Show the date separator BELOW this bubble (rendered above in inverted list)
    // when it belongs to a different day than the older neighbour.
    const prevDate = prevMessage ? formatDate(prevMessage.createdAt || prevMessage.timestamp) : null;
    const thisDate = formatDate(time);
    const showDateSep = prevDate !== null && prevDate !== thisDate;

    return (
      <>
        {showDateSep && (
          <View style={styles.dateSep}>
            <Text style={styles.dateSepText}>{thisDate}</Text>
          </View>
        )}
        <View style={[styles.bubbleRow, isOut ? styles.bubbleRowOut : styles.bubbleRowIn]}>
          <TouchableOpacity
            activeOpacity={failed ? 0.7 : 1}
            disabled={!failed}
            onPress={failed && onRetry ? () => onRetry(message) : undefined}
            style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn, failed && styles.bubbleFailed]}
          >
            {message.mediaUrl && <MediaBubble message={message} isOut={isOut} />}
            {!!text && (
              <Text style={[styles.bubbleText, isOut && styles.bubbleTextOut]}>{text}</Text>
            )}
            <View style={styles.bubbleMeta}>
              {failed && <Text style={styles.retryHint}>Tap to retry</Text>}
              <Text style={[styles.bubbleTime, isOut && styles.bubbleTimeOut]}>
                {formatTime(time)}
              </Text>
              {isOut && <StatusTick status={message.status} />}
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  },
  // Only re-render a row when something visible about it actually changes.
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.mediaUrl === next.message.mediaUrl &&
    (prev.message.textBody || prev.message.body || prev.message.text) ===
      (next.message.textBody || next.message.body || next.message.text) &&
    (prev.prevMessage?.createdAt || prev.prevMessage?.timestamp) ===
      (next.prevMessage?.createdAt || next.prevMessage?.timestamp)
);

// ─── Template Picker Modal ────────────────────────────────────────────────────

function TemplatePicker({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (t: Template) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .get("/api/templates")
      .then((r) => {
        const d = r.data ?? {};
        const items: Template[] = Array.isArray(d)
          ? d
          : Array.isArray(d.items)
          ? d.items
          : Array.isArray(d.content)
          ? d.content
          : [];
        setTemplates(
          items.filter((t) => (t as any).status === "APPROVED" || !(t as any).status)
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={tpStyles.header}>
          <Text style={tpStyles.title}>Send Template</Text>
          <TouchableOpacity onPress={onClose} style={tpStyles.closeBtn}>
            <Text style={tpStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0f766e" />
        ) : (
          <FlatList
            data={templates}
            keyExtractor={(t) => String(t.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>
                No approved templates
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={tpStyles.row}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={tpStyles.name}>
                  {item.metaTemplateName || item.name || "(unnamed)"}
                </Text>
                {!!item.category && <Text style={tpStyles.cat}>{item.category}</Text>}
                {!!item.body && (
                  <Text style={tpStyles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const tpStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cat: { fontSize: 11, color: "#0f766e", marginTop: 3, fontWeight: "600" },
  body: { fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 17 },
});

// ─── Media Library Picker Modal ───────────────────────────────────────────────
// Mirrors web's MediaLibraryDialog: fetches already-hosted assets from the CRM
// and returns a publicUrl — no file upload needed.

function MediaLibraryPicker({
  visible,
  onClose,
  onSelect,
  allowedType,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  allowedType?: string; // if set, lock filter to this type
  title?: string;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO">("ALL");

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError("");
    // If locked to a specific type, reset filter to match
    if (allowedType) {
      setFilter(allowedType as any);
    }
    api
      .get("/api/media-assets")
      .then((r) => {
        const d = r.data ?? {};
        const items: MediaAsset[] = Array.isArray(d)
          ? d
          : Array.isArray(d.items)
          ? d.items
          : Array.isArray(d.content)
          ? d.content
          : [];
        setAssets(items);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || "Failed to load media");
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const activeFilter = allowedType ? (allowedType as any) : filter;
  const filtered =
    activeFilter === "ALL" ? assets : assets.filter((a) => a.mediaType === activeFilter);

  const filterTypes: Array<"ALL" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO"> = [
    "ALL", "IMAGE", "VIDEO", "DOCUMENT", "AUDIO",
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Header */}
        <View style={mlStyles.header}>
          <Text style={mlStyles.title}>{title ?? "Media Library"}</Text>
          <TouchableOpacity onPress={onClose} style={mlStyles.closeBtn}>
            <Text style={mlStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={mlStyles.hint}>
          {allowedType
            ? `Choose a ${allowedType.toLowerCase()} for the template header.`
            : "Tap any asset to send it. These are already-hosted public URLs — no upload needed."}
        </Text>

        {/* Type filter tabs — hidden when locked to a specific type */}
        {!allowedType && (
          <View style={mlStyles.filterRow}>
            {filterTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilter(type)}
                style={[mlStyles.filterBtn, filter === type && mlStyles.filterBtnActive]}
              >
                <Text style={[mlStyles.filterText, filter === type && mlStyles.filterTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0f766e" />
        ) : error ? (
          <Text style={mlStyles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={mlStyles.emptyText}>
            No {filter === "ALL" ? "" : filter.toLowerCase() + " "}assets found.{"\n"}
            Upload files from the web CRM → Media Library first.
          </Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={mlStyles.assetRow}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                {item.mediaType === "IMAGE" && item.publicUrl ? (
                  <Image
                    source={{ uri: item.publicUrl }}
                    style={mlStyles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[mlStyles.thumb, mlStyles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 28 }}>
                      {item.mediaType === "VIDEO"
                        ? "🎬"
                        : item.mediaType === "AUDIO"
                        ? "🎵"
                        : "📄"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={mlStyles.assetName} numberOfLines={1}>
                    {item.originalFileName || item.name || "Untitled"}
                  </Text>
                  <Text style={mlStyles.assetType}>{item.mediaType}</Text>
                  {!!item.createdAt && (
                    <Text style={mlStyles.assetDate}>
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                        new Date(item.createdAt)
                      )}
                    </Text>
                  )}
                </View>
                <Text style={mlStyles.selectArrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const mlStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  hint: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  filterBtnActive: { backgroundColor: "#0f766e" },
  filterText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  filterTextActive: { color: "#fff" },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  assetName: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  assetType: { fontSize: 11, color: "#0f766e", marginTop: 2, fontWeight: "600" },
  assetDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  selectArrow: { fontSize: 22, color: "#94a3b8" },
  errorText: { color: "#ef4444", textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
});

// ─── Attachment action sheet ──────────────────────────────────────────────────

function AttachMenu({
  visible,
  onClose,
  onTemplate,
  onMediaLibrary,
  onUploadDevice,
  onFlow,
}: {
  visible: boolean;
  onClose: () => void;
  onTemplate: () => void;
  onMediaLibrary: () => void;
  onUploadDevice: () => void;
  onFlow: () => void;
}) {
  if (!visible) return null;
  return (
    <TouchableOpacity style={amStyles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={amStyles.sheet}>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onTemplate();
          }}
        >
          <View style={[amStyles.iconCircle, { backgroundColor: "#e7f5ff" }]}>
            <Ionicons name="document-text-outline" size={22} color="#1971c2" />
          </View>
          <View>
            <Text style={amStyles.label}>Send Template</Text>
            <Text style={amStyles.sublabel}>WhatsApp approved templates</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onMediaLibrary();
          }}
        >
          <View style={[amStyles.iconCircle, { backgroundColor: "#f3f0ff" }]}>
            <Ionicons name="images-outline" size={22} color="#7048e8" />
          </View>
          <View>
            <Text style={amStyles.label}>Send Media</Text>
            <Text style={amStyles.sublabel}>Images, videos, documents from CRM library</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onUploadDevice();
          }}
        >
          <View style={[amStyles.iconCircle, { backgroundColor: "#ebfbee" }]}>
            <Ionicons name="folder-open-outline" size={22} color="#2f9e44" />
          </View>
          <View>
            <Text style={amStyles.label}>Upload from Device</Text>
            <Text style={amStyles.sublabel}>Pick a file from your phone and send</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onFlow();
          }}
        >
          <View style={[amStyles.iconCircle, { backgroundColor: "#fff4e6" }]}>
            <Ionicons name="reader-outline" size={22} color="#e8590c" />
          </View>
          <View>
            <Text style={amStyles.label}>Send Flow</Text>
            <Text style={amStyles.sublabel}>Interactive WhatsApp Flow form</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={amStyles.cancel} onPress={onClose}>
          <Text style={amStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const amStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    zIndex: 99,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  sublabel: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 13, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 14 },
  cancelText: {
    fontSize: 15,
    color: "#dc2626",
    fontWeight: "600",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
});

// ─── Template Confirm Sheet ───────────────────────────────────────────────────
// Shown after a template is selected. Matches the web UX:
//   • Template name + body preview
//   • If template has IMAGE/VIDEO/DOCUMENT header:
//       - "Header image URL" label  +  "Choose header media" button (side by side)
//       - Text input pre-filled from media library pick, or typed manually
//   • Send button

function TemplateConfirmSheet({
  template,
  onClose,
  onSend,
}: {
  template: Template | null;
  onClose: () => void;
  onSend: (t: Template, headerMediaUrl: string | null) => void;
}) {
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerPickerOpen, setHeaderPickerOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  const headerFormat = template ? templateHeaderMediaFormat(template) : "";

  useEffect(() => {
    if (template) {
      setHeaderMediaUrl("");
      setValidationError("");
    }
  }, [template]);

  function handleSend() {
    if (headerFormat && !headerMediaUrl.trim()) {
      setValidationError(
        `Please choose a ${headerFormat.toLowerCase()} for this template's header.`
      );
      return;
    }
    setValidationError("");
    onSend(template!, headerMediaUrl.trim() || null);
  }

  if (!template) return null;

  const displayName = template.metaTemplateName || template.name || "(unnamed)";
  const bodyText = template.body || "";
  const headerLabel = headerFormat
    ? `Header ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} URL`
    : "";
  const headerPlaceholder =
    headerFormat === "IMAGE"
      ? "https://example.com/header.jpg"
      : headerFormat === "VIDEO"
      ? "https://example.com/header.mp4"
      : "https://example.com/header.pdf";

  return (
    <Modal
      visible={!!template}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Sheet header */}
        <View style={tcStyles.header}>
          <Text style={tcStyles.title}>Send Template</Text>
          <TouchableOpacity onPress={onClose} style={tcStyles.closeBtn}>
            <Text style={tcStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={tcStyles.body} keyboardShouldPersistTaps="handled">
          {/* Template preview card */}
          <View style={tcStyles.card}>
            <Text style={tcStyles.tplName}>{displayName}</Text>
            {!!template.category && (
              <Text style={tcStyles.tplCat}>{template.category}</Text>
            )}
            {!!bodyText && (
              <Text style={tcStyles.tplBody}>{bodyText}</Text>
            )}
          </View>

          {/* Header media section — only shown when template HEADER needs IMAGE/VIDEO/DOCUMENT */}
          {!!headerFormat && (
            <View style={tcStyles.section}>
              {/* Label row: "Header image URL"  |  [Choose header media] */}
              <View style={tcStyles.headerLabelRow}>
                <Text style={tcStyles.sectionLabel}>{headerLabel}</Text>
                <TouchableOpacity
                  style={tcStyles.chooseBtn}
                  onPress={() => setHeaderPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={tcStyles.chooseBtnIcon}>
                    {headerFormat === "IMAGE" ? "🖼️" : headerFormat === "VIDEO" ? "🎬" : "📄"}
                  </Text>
                  <Text style={tcStyles.chooseBtnText}>Choose header media</Text>
                </TouchableOpacity>
              </View>

              {/* URL text input (pre-filled from library pick, or typed manually) */}
              <TextInput
                style={tcStyles.urlInput}
                placeholder={headerPlaceholder}
                placeholderTextColor="#94a3b8"
                value={headerMediaUrl}
                onChangeText={(v) => { setHeaderMediaUrl(v); setValidationError(""); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              {/* Thumbnail preview once a URL is set */}
              {!!headerMediaUrl.trim() && headerFormat === "IMAGE" && (
                <Image
                  source={{ uri: headerMediaUrl.trim() }}
                  style={tcStyles.previewThumb}
                  resizeMode="cover"
                />
              )}

              <Text style={tcStyles.hint}>
                This template requires a public HTTPS {headerFormat.toLowerCase()} header for every send.
              </Text>
            </View>
          )}

          {!!validationError && (
            <View style={tcStyles.errorBox}>
              <Text style={tcStyles.errorText}>{validationError}</Text>
            </View>
          )}
        </ScrollView>

        {/* Send button */}
        <View style={tcStyles.footer}>
          <TouchableOpacity style={tcStyles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Text style={tcStyles.sendBtnText}>Send Template</Text>
          </TouchableOpacity>
        </View>

        {/* Header media library picker — locked to the required type */}
        <MediaLibraryPicker
          visible={headerPickerOpen}
          onClose={() => setHeaderPickerOpen(false)}
          allowedType={headerFormat}
          title={`Choose ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} header media`}
          onSelect={(asset) => {
            setHeaderMediaUrl(asset.publicUrl || "");
            setHeaderPickerOpen(false);
            setValidationError("");
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const tcStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  body: { padding: 16, gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  tplName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  tplCat: { fontSize: 12, color: "#0f766e", fontWeight: "600" },
  tplBody: { fontSize: 13, color: "#475569", lineHeight: 18, marginTop: 4 },
  section: { gap: 10 },
  headerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", flex: 1 },
  chooseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  chooseBtnIcon: { fontSize: 14 },
  chooseBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  urlInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  previewThumb: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  hint: { fontSize: 11, color: "#64748b" },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  sendBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ─── WhatsApp Flow Sender ─────────────────────────────────────────────────────
// Mirrors the web chat: pick a PUBLISHED flow, optional message body and
// CTA button text, then POST /api/messages/send-whatsapp/flow.

interface WaFlow {
  id: string | number;
  name?: string;
  metaFlowId?: string;
}

function FlowSendSheet({
  visible, contactId, onClose, onSent,
}: {
  visible: boolean;
  contactId: string | number;
  onClose: () => void;
  onSent: (flowName: string) => void;
}) {
  const [flows, setFlows] = useState<WaFlow[]>([]);
  const [flowId, setFlowId] = useState<string>("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("Open form");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setError("");
    setLoading(true);
    api
      .get("/api/whatsapp-flows", { params: { status: "PUBLISHED" } })
      .then((r) => {
        const rows: WaFlow[] = Array.isArray(r.data) ? r.data : r.data?.content ?? r.data?.items ?? [];
        setFlows(rows);
        setFlowId((cur) => cur || (rows[0]?.id != null ? String(rows[0].id) : ""));
      })
      .catch((err: any) => {
        setFlows([]);
        setError(err?.response?.data?.message || err?.message || "Failed to load flows");
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const selected = flows.find((f) => String(f.id) === flowId) || null;
  const needsMeta = Boolean(selected && (!selected.metaFlowId || String(selected.metaFlowId).startsWith("local-flow-")));

  async function send() {
    if (!flowId || sending) return;
    setSending(true);
    setError("");
    try {
      await api.post("/api/messages/send-whatsapp/flow", {
        contactId,
        flowId: Number(flowId),
        body: body.trim() || null,
        ctaText: ctaText.trim() || null,
      });
      setBody("");
      onSent(selected?.name || "Flow");
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to send WhatsApp Flow");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={fsStyles.header}>
          <Text style={fsStyles.title}>Send WhatsApp Flow</Text>
          <TouchableOpacity onPress={onClose} style={fsStyles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={fsStyles.bodyWrap} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator color="#0f766e" style={{ marginTop: 30 }} />
          ) : flows.length === 0 ? (
            <View style={fsStyles.emptyBox}>
              <Ionicons name="reader-outline" size={32} color="#9ca3af" />
              <Text style={fsStyles.emptyText}>
                No published flows. Create and publish a WhatsApp Flow from the web CRM first.
              </Text>
            </View>
          ) : (
            <>
              <Text style={fsStyles.label}>Flow</Text>
              {flows.map((f) => {
                const active = String(f.id) === flowId;
                return (
                  <TouchableOpacity
                    key={String(f.id)}
                    style={[fsStyles.flowRow, active && fsStyles.flowRowActive]}
                    onPress={() => setFlowId(String(f.id))}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={19}
                      color={active ? "#0f766e" : "#9ca3af"}
                    />
                    <Text style={[fsStyles.flowName, active && { color: "#0f766e" }]} numberOfLines={1}>
                      {f.name || `Flow ${f.id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {needsMeta && (
                <View style={fsStyles.warnBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#b45309" />
                  <Text style={fsStyles.warnText}>
                    This flow is not synced with Meta yet. Publish it to Meta from the web CRM before sending.
                  </Text>
                </View>
              )}

              <Text style={fsStyles.label}>Button text</Text>
              <TextInput
                style={fsStyles.input}
                value={ctaText}
                onChangeText={setCtaText}
                placeholder="Open form"
                placeholderTextColor="#9ca3af"
                maxLength={20}
              />

              <Text style={fsStyles.label}>Message (optional)</Text>
              <TextInput
                style={[fsStyles.input, fsStyles.inputMultiline]}
                value={body}
                onChangeText={setBody}
                placeholder="Short message shown above the flow button…"
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
              />

              {!!error && <Text style={fsStyles.errorText}>{error}</Text>}
            </>
          )}
        </ScrollView>

        {flows.length > 0 && (
          <View style={fsStyles.footer}>
            <TouchableOpacity
              style={[fsStyles.sendBtn, (!flowId || sending) && { opacity: 0.5 }]}
              onPress={send}
              disabled={!flowId || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={fsStyles.sendBtnText}>Send Flow</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const fsStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.15)",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  closeBtn: { padding: 4 },
  bodyWrap: { padding: 18, gap: 6, paddingBottom: 30 },
  label: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 12,
    marginBottom: 6,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(118,118,128,0.05)",
    marginBottom: 6,
  },
  flowRowActive: { backgroundColor: "#f0fdfa" },
  flowName: { flex: 1, fontSize: 14.5, color: "#111827", fontWeight: "500" },
  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 11,
    marginTop: 8,
  },
  warnText: { flex: 1, fontSize: 12.5, color: "#92400e", lineHeight: 17 },
  input: {
    backgroundColor: "rgba(118,118,128,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.2)",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    color: "#111827",
  },
  inputMultiline: { minHeight: 90 },
  errorText: { fontSize: 13, color: "#dc2626", fontWeight: "600", marginTop: 10 },
  emptyBox: { alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  emptyText: { fontSize: 13.5, color: "#6b7280", textAlign: "center", lineHeight: 19 },
  footer: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.15)",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatConversationScreen({ route }: Props) {
  const { inbox } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [attachOpen, setAttachOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [flowSheetOpen, setFlowSheetOpen] = useState(false);
  // WhatsApp-style "jump to latest" affordance: while the user has scrolled
  // up to read older messages, new incoming/outgoing messages shouldn't
  // silently appear off-screen — show a floating pill instead of forcing
  // a jump, and only auto-follow the bottom when the user is already there.
  const [showNewMessagePill, setShowNewMessagePill] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  // Inverted list: offset 0 == visually at the bottom (the newest message).
  const atBottomRef = useRef(true);
  const lastTopKeyRef = useRef<string | null>(null);
  // While the user's finger is actively on the list, a background poll
  // landing mid-gesture is what makes a refresh feel like it "interrupts"
  // or breaks the scroll — so we hold onto the freshest fetch and only
  // apply it once the gesture settles, instead of merging immediately.
  const isTouchingRef = useRef(false);
  const pendingContentRef = useRef<Message[] | null>(null);
  // Prevents overlapping poll requests: on a slow/flaky connection a fetch
  // can still be in flight when the next tick fires. Without this guard,
  // requests pile up and their responses can land out of order, which is
  // exactly what makes polling feel "unreliable" instead of just slower.
  const isRefreshInFlightRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (p = 0) => {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const data = await fetchMessages(inbox.contactId, p);
        // The backend's ordering isn't guaranteed to already be
        // newest-first — some endpoints return ascending (oldest first)
        // per page. Since this is an INVERTED FlatList, index 0 must
        // always be the newest message or the whole thread renders out
        // of order and new messages won't land at the bottom like
        // WhatsApp. Sort explicitly rather than trust the API's order.
        const content = data.content ?? [];
        // Merge rather than replace so optimistic sends and previously
        // loaded older pages survive a page-0 refresh (used by polling too).
        setMessages((prev) => mergeMessages(prev, content));
        setTotalPages(data.totalPages ?? 1);
        setPage(p);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err.message || "Failed to load messages"
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [inbox.contactId]
  );

  const badges = useBadges();
  useEffect(() => {
    load(0);
    // Mark ONLY this conversation read (same as the web app), then pull the
    // badge down by this conversation's unread count so the tab updates
    // immediately instead of waiting for the next inbox load.
    markAsRead(inbox.contactId)
      .then(() => {
        const mine = Number(inbox.unreadCount) || 0;
        if (mine > 0) badges.setChatCount(Math.max(0, badges.chat - mine));
        else badges.refresh();
      })
      .catch(() => {});
  }, []);

  // Silent page-0 refresh (no loading spinner) used by the live poll so new
  // inbound messages stream in while the chat is open, WhatsApp-style.
  //
  // Guarded against overlap: if a previous refreshLatest() call hasn't
  // resolved yet (slow network), a new tick is skipped entirely rather than
  // firing another request on top of it. Without this, a slow response can
  // still be in flight when 2-3 more ticks fire, and their responses can
  // resolve in any order — which reads as "sometimes new messages just
  // don't show up" even though a poll technically ran on schedule.
  const refreshLatest = useCallback(async () => {
    if (isRefreshInFlightRef.current) return;
    isRefreshInFlightRef.current = true;
    try {
      const data = await fetchMessages(inbox.contactId, 0);
      const content = data.content ?? [];
      if (isTouchingRef.current) {
        // Don't merge mid-gesture — hold the latest fetch and apply it as
        // soon as the user's finger lifts, so a poll can never yank the
        // list out from under an active swipe.
        pendingContentRef.current = content;
        return;
      }
      setMessages((prev) => mergeMessages(prev, content));
    } catch {
      // Ignore poll errors — the next tick will retry.
    } finally {
      isRefreshInFlightRef.current = false;
    }
  }, [inbox.contactId]);

  // Applies whatever the most recent poll fetched but held back, called
  // once the current touch/scroll gesture ends.
  const flushPendingContent = useCallback(() => {
    isTouchingRef.current = false;
    if (pendingContentRef.current) {
      const content = pendingContentRef.current;
      pendingContentRef.current = null;
      setMessages((prev) => mergeMessages(prev, content));
    }
  }, []);

  // Live polling: while this screen is mounted (i.e. the chat is open) fetch
  // the latest messages every few seconds so inbound replies stream in
  // WhatsApp-style without leaving the screen.
  //
  // Two changes from a plain `setInterval`:
  //  1. Self-rescheduling `setTimeout` chain — the next tick is only queued
  //     AFTER the current refreshLatest() call finishes, so a slow response
  //     can never cause a pile-up of overlapping requests.
  //  2. An AppState listener that force-refreshes the instant the app comes
  //     back to the foreground. JS timers are paused/throttled while the
  //     app is backgrounded, so a message that arrives while the phone is
  //     locked or the app is minimized would otherwise just sit there,
  //     unseen, until the (delayed) next tick eventually fires — this is
  //     the single most common reason polling "sometimes" misses a message
  //     on a real device. `useFocusEffect` below only covers in-app
  //     navigation focus changes, not the app being backgrounded/foregrounded.
  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutRef.current = setTimeout(tick, 3500);
    };

    const tick = () => {
      if (cancelled) return;
      refreshLatest().finally(scheduleNext);
    };

    scheduleNext();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      refreshLatest().finally(scheduleNext);
    });

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      appStateSub.remove();
    };
  }, [refreshLatest]);

  // Also refresh immediately whenever the screen regains focus (e.g. coming
  // back from a modal or another tab) so it never shows a stale thread.
  useFocusEffect(
    useCallback(() => {
      refreshLatest();
    }, [refreshLatest])
  );

  const scrollToLatest = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
    atBottomRef.current = true;
    setShowNewMessagePill(false);
    setNewMessageCount(0);
  }, []);

  // Whenever the newest message changes (poll picked up an inbound reply, or
  // we/another tab sent something), either silently keep following the
  // bottom (WhatsApp behaviour when you're already caught up) or surface a
  // "New messages" pill instead of yanking the user away from what they're
  // reading — exactly like WhatsApp does when you're scrolled up.
  useEffect(() => {
    const top = messages[0];
    if (!top) return;
    // Keyed by CONTENT (direction+text+media), not id. If we keyed off the
    // id, an optimistic "temp-..." message getting resolved to its real
    // server id on the next poll would look like a brand-new message and
    // re-fire the scroll/pill logic every ~3.5s — which is exactly what
    // made the thread feel jumpy/broken after sending.
    const topKey = messageSignature(top);

    if (lastTopKeyRef.current === null) {
      // First load — nothing "new" yet, just record where we are.
      lastTopKeyRef.current = topKey;
      return;
    }

    if (topKey !== lastTopKeyRef.current) {
      if (atBottomRef.current) {
        // Already at the bottom — just glide down to the new message,
        // like WhatsApp does when the chat is open and you're caught up.
        requestAnimationFrame(() => scrollToLatest(true));
      } else {
        // User is reading older messages — don't yank them down, show a
        // tappable "New message" pill instead.
        setShowNewMessagePill(true);
        setNewMessageCount((c) => c + 1);
      }
      lastTopKeyRef.current = topKey;
    }
  }, [messages, scrollToLatest]);

  // Inverted list: prepending puts the new message at the bottom instantly.
  const appendOptimistic = (msg: Message) => {
    setMessages((prev) => [msg, ...prev]);
    // Our own sends should always land at the bottom immediately, the same
    // way WhatsApp snaps you down when you hit send.
    lastTopKeyRef.current = messageSignature(msg);
    requestAnimationFrame(() => scrollToLatest(true));
  };

  const setMessageStatus = useCallback((id: Message["id"], status: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);

  // Core outgoing-text send. Renders an optimistic bubble immediately
  // (status SENDING), flips it to SENT on success or FAILED on error so the
  // user can tap to retry. The next poll swaps the temp bubble for the real
  // server message (deduped by content signature) — no duplicates.
  const sendText = useCallback(
    async (body: string, existingTempId?: Message["id"]) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const tempId = existingTempId ?? `temp-${Date.now()}`;
      if (existingTempId) {
        setMessageStatus(existingTempId, "SENDING");
      } else {
        setMessages((prev) => [
          {
            id: tempId,
            textBody: trimmed,
            direction: "OUTBOUND",
            createdAt: new Date().toISOString(),
            status: "SENDING",
          } as Message,
          ...prev,
        ]);
      }
      setSending(true);
      try {
        await sendTextMessage(inbox.contactId, trimmed);
        setMessageStatus(tempId, "SENT");
        // Pull the confirmed server copy in promptly instead of waiting for
        // the next poll tick.
        refreshLatest();
      } catch {
        setMessageStatus(tempId, "FAILED");
      } finally {
        setSending(false);
      }
    },
    [inbox.contactId, refreshLatest, setMessageStatus]
  );

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    await sendText(trimmed);
  }

  // Tapping a FAILED bubble re-sends its text and clears the failed one.
  const handleRetry = useCallback(
    (msg: Message) => {
      const body = msg.textBody || msg.body || msg.text || "";
      if (!body.trim()) return;
      sendText(body, msg.id);
    },
    [sendText]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      // In an inverted list index 0 is the newest message (bottom).
      // The "previous" message in time is at index+1 (above it).
      <MessageBubble message={item} prevMessage={messages[index + 1]} onRetry={handleRetry} />
    ),
    [messages, handleRetry]
  );

  async function handleSendTemplate(template: Template, headerMediaUrl: string | null) {
    setSelectedTemplate(null);
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      textBody: `[Template: ${template.metaTemplateName || template.name}]`,
      direction: "OUTBOUND",
      createdAt: new Date().toISOString(),
      status: "SENT",
    };
    appendOptimistic(optimistic);
    try {
      await api.post("/api/messages/send-whatsapp/template", {
        contactId: inbox.contactId,
        templateId: template.id,
        bodyParameters: [],
        headerMediaUrl: headerMediaUrl || null,
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(
        err?.response?.data?.message || err?.message || "Failed to send template"
      );
    } finally {
      setSending(false);
    }
  }

  // ── Send media from CRM library (no upload — uses already-hosted publicUrl) ─
  async function handleSendMediaAsset(asset: MediaAsset) {
    setMediaLibraryOpen(false);
    if (!asset.publicUrl) {
      setError("Selected asset has no public URL. Re-upload it from the web CRM.");
      return;
    }

    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      mediaUrl: asset.publicUrl,
      mediaType: asset.mediaType,
      mediaFileName: asset.originalFileName || asset.name || "Attachment",
      direction: "OUTBOUND",
      createdAt: new Date().toISOString(),
      status: "SENT",
    };
    appendOptimistic(optimistic);

    try {
      // Identical to what the web app does in sendMediaMessage()
      await api.post("/api/messages/send-whatsapp/media", {
        contactId: inbox.contactId,
        mediaType: asset.mediaType,
        mediaUrl: asset.publicUrl,
        fileName: asset.originalFileName || asset.name || null,
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(
        err?.response?.data?.message || err?.message || "Failed to send media"
      );
    } finally {
      setSending(false);
    }
  }

  async function handleUploadFromDevice() {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    } catch {
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
      const uploadRes = await api.post("/api/media-assets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const publicUrl: string = uploadRes.data?.publicUrl || uploadRes.data?.url || "";
      if (!publicUrl) throw new Error("Upload succeeded but no public URL returned.");

      const mimeType = file.mimeType || "";
      const mediaType = mimeType.startsWith("image/") ? "IMAGE"
        : mimeType.startsWith("video/") ? "VIDEO"
        : mimeType.startsWith("audio/") ? "AUDIO"
        : "DOCUMENT";

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        mediaUrl: publicUrl,
        mediaType,
        mediaFileName: file.name,
        direction: "OUTBOUND",
        createdAt: new Date().toISOString(),
        status: "SENT",
      };
      appendOptimistic(optimistic);

      await api.post("/api/messages/send-whatsapp/media", {
        contactId: inbox.contactId,
        mediaType,
        mediaUrl: publicUrl,
        fileName: file.name || null,
      });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.response?.data?.message || err?.message || "Failed to upload file.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading conversation…" />;

  return (
    // No bottom edge: the BottomTabBar below already absorbs the bottom
    // inset, so adding it here doubled up as a gap under the input bar
    <SafeAreaView style={styles.root} edges={[]}>
      <ImageBackground
        source={require("../../../assets/watsapp-chatbg.jpg")}
        resizeMode="cover"
        style={{ flex: 1, overflow: "hidden" }}
      >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {!!error && <ErrorBanner message={error} />}

        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) =>
              String(
                item.id ?? item.messageId ?? item.createdAt ?? item.timestamp ?? index
              )
            }
            // inverted=true flips the list so index-0 sits at the bottom, exactly
            // like WhatsApp. Newest messages (prepended) appear at the bottom.
            inverted
            // NOTE: we deliberately do NOT set maintainVisibleContentPosition
            // here. On an inverted list it anchors index-0 (the newest
            // message), which pins freshly-polled inbound messages off-screen
            // at the bottom so they only appear after a remount (go back /
            // refresh). Jitter on no-op polls is instead prevented by
            // mergeMessages returning the SAME array reference when nothing
            // changed (and reusing unchanged message objects), and new-message
            // scrolling is handled explicitly by the scroll-follow effect
            // below (auto-glide when caught up, "New message" pill otherwise).
            // Memoized row (see MessageBubble) + onRetry for failed sends.
            renderItem={renderMessage}
            // onEndReached fires when the user scrolls UP to the top (inverted).
            onEndReached={() => {
              if (!loadingMore && page + 1 < totalPages) load(page + 1);
            }}
            onEndReachedThreshold={0.2}
            // Track whether the user is currently at the visual bottom of the
            // thread so incoming messages either auto-follow (WhatsApp-style)
            // or surface a "New message" pill instead of jumping the screen.
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              const nowAtBottom = y < 60;
              atBottomRef.current = nowAtBottom;
              if (nowAtBottom && showNewMessagePill) {
                setShowNewMessagePill(false);
                setNewMessageCount(0);
              }
            }}
            scrollEventThrottle={80}
            onScrollBeginDrag={() => {
              isTouchingRef.current = true;
            }}
            onScrollEndDrag={flushPendingContent}
            onMomentumScrollEnd={flushPendingContent}
            contentContainerStyle={styles.messageList}
            // ── Performance: keep scrolling smooth with long threads ──
            removeClippedSubviews={Platform.OS === "android"}
            initialNumToRender={15}
            maxToRenderPerBatch={12}
            windowSize={11}
            updateCellsBatchingPeriod={40}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
              </View>
            }
            // Show a loading indicator at the top (rendered at bottom in inverted)
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color="#0f766e" style={{ marginVertical: 8 }} />
              ) : null
            }
          />

          {/* WhatsApp-style "jump to latest" pill — only shown once the user
              has scrolled away from the bottom and a new message arrives. */}
          {showNewMessagePill && (
            <TouchableOpacity
              style={styles.newMessagePill}
              onPress={() => scrollToLatest(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-down" size={14} color="#fff" />
              <Text style={styles.newMessagePillText}>
                {newMessageCount > 1 ? `${newMessageCount} new messages` : "New message"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI panel — collapsible + bounded height with its own scroller so a
            long AI response never pushes the input bar off-screen or breaks
            the chat layout. */}
        {aiPanelOpen && (
          <View style={styles.aiPanelWrap}>
            <View style={styles.aiPanelHeader}>
              <TouchableOpacity
                style={styles.aiPanelHeaderLeft}
                onPress={() => setAiPanelCollapsed((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={14} color="#0f766e" />
                <Text style={styles.aiPanelHeaderText}>AI Chat Assistant</Text>
                <Ionicons
                  name={aiPanelCollapsed ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#64748b"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAiPanelOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
            {!aiPanelCollapsed && (
              <ScrollView
                style={styles.aiPanelScroll}
                contentContainerStyle={styles.aiPanelScrollContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <AiAssistPanel
                  contactId={inbox.contactId}
                  title="AI Chat Assistant"
                  contextPrompt={
                    `Contact: ${inbox.contactName || ""}. ` +
                    `Last messages:\n` +
                    messages
                      .slice(0, 12)
                      .reverse()
                      .map((m) => `${m.direction === "OUTBOUND" ? "Agent" : "Contact"}: ${m.textBody || m.mediaType || ""}`)
                      .join("\n") +
                    `\n\nSummarise this WhatsApp conversation and recommend the next best CRM action.`
                  }
                  replyPrompt={
                    `Contact: ${inbox.contactName || ""}.\n` +
                    `Last messages:\n` +
                    messages
                      .slice(0, 12)
                      .reverse()
                      .map((m) => `${m.direction === "OUTBOUND" ? "Agent" : "Contact"}: ${m.textBody || m.mediaType || ""}`)
                      .join("\n") +
                    `\n\nWrite a short, warm WhatsApp reply to continue this conversation. Keep it human and helpful.`
                  }
                  onApply={(t) => {
                    // AI output — especially a conversation summary — can be
                    // long, multi-paragraph text. Dropping it verbatim into
                    // the compose box used to make the input pill balloon
                    // past its bounds and break the input bar layout, so
                    // normalise whitespace and cap it to something that's
                    // actually usable as a WhatsApp message draft.
                    const clean = t.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
                    const MAX_DRAFT_LEN = 1000;
                    const capped =
                      clean.length > MAX_DRAFT_LEN
                        ? clean.slice(0, MAX_DRAFT_LEN).trim() + "…"
                        : clean;
                    setText((prev) => (prev.trim() ? prev.trim() + "\n" + capped : capped));
                    // Collapse (not close) the panel so the compose box and
                    // the newly inserted draft are immediately visible
                    // instead of both fighting for screen space.
                    setAiPanelCollapsed(true);
                  }}
                  applyLabel="Use in message"
                />
              </ScrollView>
            )}
          </View>
        )}

        {/* Input bar — WhatsApp style: white pill with actions inside */}
        <View style={styles.inputBar}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor="#8696a0"
              value={text}
              onChangeText={setText}
              multiline
              scrollEnabled
              maxLength={4096}
            />
            <TouchableOpacity
              style={styles.pillIconBtn}
              onPress={() => setAiPanelOpen((v) => !v)}
            >
              <Ionicons name="sparkles-outline" size={21} color={aiPanelOpen ? "#0f766e" : "#54656f"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pillIconBtn}
              onPress={() => setAttachOpen(true)}
            >
              <Ionicons name="attach" size={24} color="#54656f" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      </ImageBackground>

      <AttachMenu
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onTemplate={() => setTemplatePickerOpen(true)}
        onMediaLibrary={() => setMediaLibraryOpen(true)}
        onUploadDevice={handleUploadFromDevice}
        onFlow={() => setFlowSheetOpen(true)}
      />

      <TemplatePicker
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(t) => {
          setTemplatePickerOpen(false);
          setSelectedTemplate(t);
        }}
      />

      <TemplateConfirmSheet
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onSend={handleSendTemplate}
      />

      <MediaLibraryPicker
        visible={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={handleSendMediaAsset}
      />

      <FlowSendSheet
        visible={flowSheetOpen}
        contactId={inbox.contactId}
        onClose={() => setFlowSheetOpen(false)}
        onSent={(flowName) => {
          appendOptimistic({
            id: `temp-${Date.now()}`,
            textBody: `[Flow: ${flowName}]`,
            direction: "OUTBOUND",
            createdAt: new Date().toISOString(),
            status: "SENT",
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fbfbfb", overflow: "hidden" },
  messageList: { paddingHorizontal: 14, paddingVertical: 10, gap: 3, paddingBottom: 8, width: "100%" },
  dateSep: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateSepText: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "600",
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  bubbleRow: { marginVertical: 1.5, width: "100%" },
  bubbleRowIn: { alignItems: "flex-start" },
  bubbleRowOut: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    flexShrink: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 5,
    gap: 1,
  },
  bubbleIn: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleOut: {
    backgroundColor: "#d9fdd3",
    borderTopRightRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleFailed: {
    backgroundColor: "#fee2e2",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#fca5a5",
  },
  retryHint: {
    fontSize: 10.5,
    color: "#dc2626",
    fontWeight: "600",
    marginRight: 6,
  },
  bubbleText: {
    fontSize: 15,
    color: "#111b21",
    lineHeight: 20,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    flexShrink: 1,
    // react-native-web: long unbroken strings (URLs, ids) otherwise push
    // the bubble past the screen edge and the whole page scrolls sideways
    ...(Platform.OS === "web" ? ({ wordBreak: "break-word", overflowWrap: "anywhere" } as any) : null),
  },
  bubbleTextOut: { color: "#111b21" },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 1,
  },
  bubbleTime: { fontSize: 10.5, color: "#667781", letterSpacing: 0.1 },
  bubbleTimeOut: { color: "#667781" },
  statusIcon: { marginLeft: 3, marginBottom: -2 },
  mediaImage: { width: 230, maxWidth: "100%", height: 172, borderRadius: 12, marginBottom: 4 },
  mediaFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  mediaFileName: { fontSize: 13, color: "#1e293b", flex: 1, flexShrink: 1 },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyChatText: { color: "#94a3b8", fontSize: 14 },
  newMessagePill: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f766e",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  newMessagePillText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 6 : 8,
    backgroundColor: "transparent",
    gap: 6,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingLeft: 6,
    paddingRight: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "ios" ? 13 : 11,
    paddingBottom: Platform.OS === "ios" ? 13 : 11,
    fontSize: 15,
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
    color: "#111b21",
    maxHeight: 120,
    textAlignVertical: "top",
    // maxHeight alone doesn't reliably clip a multiline TextInput on every
    // platform (notably web) — without an explicit scroll behaviour, text
    // longer than the box (e.g. a pasted AI summary) overflows and breaks
    // the input pill's layout instead of scrolling inside it.
    ...(Platform.OS === "web" ? ({ overflowY: "auto" } as any) : null),
  },
  pillIconBtn: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pillIconBtnActive: { opacity: 1 },
  pillIcon: { fontSize: 19 },
  attachIcon: { fontSize: 19, color: "#54656f" },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sendBtnDisabled: {
    backgroundColor: "#0f766e",
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: { color: "#fff", fontSize: 19, marginLeft: 2 },
  aiPanelWrap: {
    marginHorizontal: 10,
    marginBottom: 6,
    maxHeight: 320,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  aiPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  aiPanelHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  aiPanelHeaderText: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  aiPanelScroll: { flexGrow: 0 },
  aiPanelScrollContent: { padding: 10, paddingBottom: 14 },
});